import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialHttpUrl = "https://terminal-chat-6pet.onrender.com";
const officialWebSocketUrl = "wss://terminal-chat-6pet.onrender.com/ws";
const failures = [];

function read(relativePath) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function tomlVersion(relativePath) {
  return read(relativePath).match(/^version\s*=\s*"([^"]+)"/m)?.[1];
}

const rootPackage = readJson("package.json");
const packageLock = readJson("package-lock.json");
const version = rootPackage.version;
const versionSources = new Map([
  ["package.json", version],
  ["package-lock.json", packageLock.version],
  [
    "backend/protocol/package.json",
    readJson("backend/protocol/package.json").version,
  ],
  [
    "backend/server/package.json",
    readJson("backend/server/package.json").version,
  ],
  [
    "frontend/desktop/package.json",
    readJson("frontend/desktop/package.json").version,
  ],
  ["frontend/cli/Cargo.toml", tomlVersion("frontend/cli/Cargo.toml")],
  [
    "frontend/desktop/src-tauri/Cargo.toml",
    tomlVersion("frontend/desktop/src-tauri/Cargo.toml"),
  ],
  [
    "frontend/desktop/src-tauri/tauri.conf.json",
    readJson("frontend/desktop/src-tauri/tauri.conf.json").version,
  ],
]);

for (const [source, sourceVersion] of versionSources) {
  requireCondition(
    sourceVersion === version,
    `${source} usa ${sourceVersion ?? "uma versão ausente"}; esperado ${version}`,
  );
}

const versionedSources = [
  "backend/server/src/app.ts",
  "backend/server/src/main.ts",
  "frontend/cli/src/app/state.rs",
  "frontend/cli/src/session.rs",
  "frontend/desktop/src/components/auth/LoginScreen.tsx",
];
for (const source of versionedSources) {
  requireCondition(
    read(source).includes(version),
    `${source} não exibe a versão ${version}`,
  );
}

const devScript = read("scripts/dev.mjs");
const windowsReleaseScript = read("scripts/package-windows.ps1");
const cliSession = read("frontend/cli/src/session.rs");
const desktopServerConfig = read(
  "frontend/desktop/src/services/serverConfig.ts",
);
requireCondition(
  devScript.includes(officialHttpUrl) &&
    devScript.includes(officialWebSocketUrl) &&
    devScript.includes("--local"),
  "scripts/dev.mjs não preserva os padrões online e o modo local explícito",
);
requireCondition(
  cliSession.includes(`DEFAULT_SERVER_URL: &str = "${officialWebSocketUrl}"`),
  "a CLI não aponta por padrão para o WebSocket oficial",
);
requireCondition(
  desktopServerConfig.includes(`DEFAULT_SERVER = "${officialHttpUrl}"`),
  "o desktop não aponta por padrão para o servidor oficial",
);
requireCondition(
  windowsReleaseScript.includes("System.Security.Cryptography.SHA256") &&
    !windowsReleaseScript.includes("Get-FileHash"),
  "o empacotamento precisa calcular SHA-256 sem depender do cmdlet Get-FileHash",
);
requireCondition(
  windowsReleaseScript.includes("terminal-chat-desktop.exe") &&
    windowsReleaseScript.includes("Windows-x64-Portable.exe"),
  "o empacotamento precisa publicar também o executável portátil do desktop",
);

const tauriConfig = readJson("frontend/desktop/src-tauri/tauri.conf.json");
const targets = Array.isArray(tauriConfig.bundle?.targets)
  ? tauriConfig.bundle.targets
  : [tauriConfig.bundle?.targets];
requireCondition(
  tauriConfig.bundle?.active === true,
  "o bundle Tauri está desativado",
);
requireCondition(
  targets.length === 1 && targets[0] === "nsis",
  "o bundle Windows precisa gerar somente o instalador NSIS",
);
requireCondition(
  tauriConfig.bundle?.windows?.webviewInstallMode?.type ===
    "downloadBootstrapper",
  "o instalador não está preparado para instalar WebView2 quando necessário",
);
requireCondition(
  tauriConfig.bundle?.windows?.nsis?.installMode === "currentUser",
  "o instalador deve funcionar sem privilégios administrativos",
);

const requiredFiles = [
  ".github/workflows/windows-release.yml",
  "Dockerfile",
  "render.yaml",
  "LICENSE",
  "DISTRIBUTION.md",
  "scripts/package-windows.ps1",
  "frontend/desktop/src-tauri/icons/icon.ico",
  "frontend/desktop/src-tauri/icons/32x32.png",
  "frontend/desktop/src-tauri/icons/128x128.png",
];
for (const relativePath of requiredFiles) {
  requireCondition(
    existsSync(join(projectRoot, relativePath)),
    `${relativePath} está ausente`,
  );
}

for (const script of ["audit:production", "release:check", "release:windows"]) {
  requireCondition(
    typeof rootPackage.scripts?.[script] === "string",
    `o comando npm ${script} está ausente`,
  );
}

requireCondition(
  rootPackage.scripts?.pretest === "npm run build:protocol",
  "npm test precisa compilar o protocolo antes dos testes em ambientes limpos",
);

const lockedWorkspaces = [
  "backend/protocol",
  "backend/server",
  "frontend/desktop",
];
for (const workspace of lockedWorkspaces) {
  requireCondition(
    packageLock.packages?.[workspace]?.version === version,
    `package-lock.json não fixa ${workspace} na versão ${version}`,
  );
}

const approvedInstallScripts = {
  "argon2@0.45.1": true,
  "es5-ext@0.10.64": false,
  "esbuild@0.27.7": true,
  "esbuild@0.28.2": true,
};
for (const [dependency, approval] of Object.entries(approvedInstallScripts)) {
  requireCondition(
    rootPackage.allowScripts?.[dependency] === approval,
    `allowScripts não fixa a decisão revisada para ${dependency}`,
  );
}
for (const [packagePath, metadata] of Object.entries(packageLock.packages)) {
  if (!metadata.hasInstallScript) continue;
  if (
    metadata.optional &&
    Array.isArray(metadata.os) &&
    !metadata.os.includes("win32")
  )
    continue;
  const dependencyName = packagePath.split("node_modules/").at(-1);
  const dependency = `${dependencyName}@${metadata.version}`;
  requireCondition(
    Object.hasOwn(rootPackage.allowScripts ?? {}, dependency),
    `${dependency} possui install script e ainda não foi revisado em allowScripts`,
  );
}

const gitignore = read(".gitignore").split(/\r?\n/);
for (const ignoredPath of [".env", ".env.*", ".terminal-chat", "artifacts"]) {
  requireCondition(
    gitignore.includes(ignoredPath),
    `${ignoredPath} precisa permanecer no .gitignore`,
  );
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  requireCondition(
    process.env.GITHUB_REF_NAME === `v${version}`,
    `a tag ${process.env.GITHUB_REF_NAME} não corresponde à versão v${version}`,
  );
}

if (failures.length > 0) {
  console.error("\nA versão não está pronta para distribuição:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Terminal Chat v${version} pronto para empacotamento.`);
console.log(`Servidor HTTP padrão: ${officialHttpUrl}`);
console.log(`Servidor WebSocket padrão: ${officialWebSocketUrl}`);
