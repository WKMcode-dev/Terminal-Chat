import type { ServerConfig } from "../config.js";
import { JsonRepository } from "./json-repository.js";
import { PostgresRepository } from "./postgres-repository.js";
import type { Repository } from "./types.js";

export * from "./types.js";

export function createRepository(config: ServerConfig): Repository {
  return config.databaseUrl
    ? new PostgresRepository(config.databaseUrl)
    : new JsonRepository(config.dataFile);
}
