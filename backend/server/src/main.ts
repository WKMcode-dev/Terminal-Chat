import { buildServer } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const server = await buildServer({ config, logger: true });

const stop = async () => {
  await server.close();
  process.exit(0);
};
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

try {
  await server.listen({ host: config.host, port: config.port });
  server.log.info(
    `Terminal Chat v2.4.0 disponível em http://${config.host}:${config.port} (${config.databaseUrl ? "PostgreSQL" : "arquivo local"})`,
  );
} catch (error) {
  server.log.error(error);
  await server.close();
  process.exit(1);
}
