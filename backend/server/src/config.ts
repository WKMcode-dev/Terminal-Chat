import { resolve } from "node:path";

import "dotenv/config";

export interface ServerConfig {
  host: string;
  port: number;
  jwtSecret: string;
  corsOrigins: string[];
  databaseUrl?: string;
  dataFile: string;
  isProduction: boolean;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const isProduction = environment.NODE_ENV === "production";
  const jwtSecret =
    environment.JWT_SECRET ?? "terminal-chat-dev-secret-change-in-production";
  if (isProduction && jwtSecret.includes("dev-secret")) {
    throw new Error("JWT_SECRET é obrigatório em produção");
  }

  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT precisa ser uma porta TCP válida");
  }

  const config: ServerConfig = {
    host: environment.HOST ?? "127.0.0.1",
    port,
    jwtSecret,
    corsOrigins: (
      environment.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    dataFile: resolve(
      environment.TERMINAL_CHAT_DATA_FILE ?? ".terminal-chat/data.json",
    ),
    isProduction,
  };
  if (environment.DATABASE_URL) config.databaseUrl = environment.DATABASE_URL;
  return config;
}
