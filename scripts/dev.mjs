import "dotenv/config";

import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const logsDirectory = join(projectRoot, ".dev-logs");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmExecutable = process.env.npm_execpath;
const defaultServerHttpUrl = "https://terminal-chat-6pet.onrender.com";
const defaultServerRealtimeUrl = "wss://terminal-chat-6pet.onrender.com/ws";
const localMode = process.argv.includes("--local");

if (localMode) {
  process.env.VITE_API_URL = "http://127.0.0.1:3000";
  process.env.TERMINAL_CHAT_SERVER = "ws://127.0.0.1:3000/ws";
} else {
  process.env.VITE_API_URL ||= defaultServerHttpUrl;
  process.env.TERMINAL_CHAT_SERVER ||= defaultServerRealtimeUrl;
}

const configuredRealtimeUrl = process.env.TERMINAL_CHAT_SERVER;
const usesRemoteServer =
  /^wss?:\/\//i.test(configuredRealtimeUrl) &&
  !/(127\.0\.0\.1|localhost)/i.test(configuredRealtimeUrl);

const services = [
  { name: "protocol", script: "dev:protocol" },
  ...(!usesRemoteServer ? [{ name: "server", script: "dev:server" }] : []),
  { name: "desktop", script: "dev:desktop" },
];

const backgroundProcesses = [];
const logDescriptors = [];
let cliProcess;
let shuttingDown = false;

mkdirSync(logsDirectory, { recursive: true });

for (const service of services) {
  const logDescriptor = openSync(
    join(logsDirectory, `${service.name}.log`),
    "w",
  );
  const child = spawnNpmScript(service.script, {
    cwd: projectRoot,
    stdio: ["ignore", logDescriptor, logDescriptor],
    windowsHide: true,
    detached: process.platform !== "win32",
  });

  backgroundProcesses.push({ ...service, child });
  logDescriptors.push(logDescriptor);
}

if (!usesRemoteServer) {
  try {
    await waitForServer("http://127.0.0.1:3000/health", 60_000);
  } catch (error) {
    console.error(`O servidor não ficou pronto: ${error.message}`);
    printServiceLog("server");
    await shutdown(1);
    process.exit(1);
  }
}

console.log(
  usesRemoteServer
    ? `Iniciando clientes no servidor remoto ${configuredRealtimeUrl}...`
    : "Iniciando protocolo, servidor e painel desktop...",
);
console.log("A interface do Terminal Chat abrirá neste terminal.\n");

cliProcess = spawnNpmScript("dev:cli", {
  cwd: projectRoot,
  stdio: "inherit",
  windowsHide: false,
});

cliProcess.on("error", (error) => {
  console.error(`Não foi possível iniciar o cliente: ${error.message}`);
  void shutdown(1);
});

cliProcess.on("exit", (code) => {
  void shutdown(code ?? 0);
});

for (const service of backgroundProcesses) {
  service.child.on("error", (error) => {
    service.error = error.message;
  });
  service.child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      service.error = `processo encerrado com código ${code}`;
    }
  });
}

process.on("SIGTERM", () => void shutdown(0));

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.all(
    backgroundProcesses.map(({ child }) => stopProcessTree(child)),
  );
  closeLogDescriptors();

  const failures = backgroundProcesses.filter((service) => service.error);
  for (const failure of failures) {
    console.error(
      `${failure.name} falhou: ${failure.error}. Consulte .dev-logs/${failure.name}.log.`,
    );
  }

  process.exitCode = failures.length > 0 ? 1 : exitCode;
}

function spawnNpmScript(script, options) {
  if (npmExecutable) {
    return spawn(process.execPath, [npmExecutable, "run", script], options);
  }

  return spawn(npmCommand, ["run", script], options);
}

function closeLogDescriptors() {
  for (const descriptor of logDescriptors) {
    try {
      closeSync(descriptor);
    } catch {
      // O descritor já pode ter sido encerrado durante a finalização do Node.
    }
  }
}

function printServiceLog(name) {
  try {
    const contents = readFileSync(join(logsDirectory, `${name}.log`), "utf8");
    if (contents.trim()) console.error(`\n${contents.trim()}\n`);
  } catch {
    // O arquivo pode não ter sido criado quando a inicialização falha cedo.
  }
}

function stopProcessTree(child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      const killer = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true },
      );
      killer.on("error", resolve);
      killer.on("exit", resolve);
      return;
    }

    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    resolve();
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "sem resposta";
  while (Date.now() < deadline) {
    const serverService = backgroundProcesses.find(
      ({ name }) => name === "server",
    );
    if (serverService?.child.exitCode !== null) {
      throw new Error(
        `processo encerrado com código ${serverService.child.exitCode}`,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(lastError);
}
