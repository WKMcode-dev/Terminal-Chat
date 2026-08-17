import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { z } from "zod";

import {
  LoginRequestSchema,
  RegisterRequestSchema,
  UsernameSchema,
} from "@terminal-chat/protocol";

import { type ServerConfig, loadConfig } from "./config.js";
import { AppError, normalizeError } from "./errors.js";
import { RealtimeHub } from "./realtime/hub.js";
import { registerRealtime } from "./realtime/register.js";
import { AuthService } from "./services/auth-service.js";
import { buildBootstrap } from "./services/bootstrap-service.js";
import { RateLimiter } from "./services/rate-limiter.js";
import {
  createRepository,
  type Repository,
  toPublicUser,
} from "./storage/index.js";

interface BuildServerOptions {
  config?: ServerConfig;
  repository?: Repository;
  logger?: boolean;
}

const CreateChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toLowerCase().replace(/\s+/g, "-"))
    .pipe(z.string().regex(/^[a-z0-9-]+$/)),
  description: z.string().trim().max(160).default(""),
});

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const repository = options.repository ?? createRepository(config);
  await repository.init();

  const server = Fastify({
    logger: options.logger ?? config.isProduction,
    bodyLimit: 64 * 1024,
    requestTimeout: 15_000,
    trustProxy: config.isProduction,
  });

  await server.register(cors, {
    credentials: false,
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Origem não autorizada"), false);
    },
  });
  await server.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: "7d" },
  });
  await server.register(websocket, { options: { maxPayload: 512 * 1024 } });

  const tokens = {
    sign: (payload: { sub: string; username: string }) =>
      server.jwt.sign(payload),
    verify<T extends { sub: string }>(token: string): T {
      return server.jwt.verify<T>(token);
    },
  };
  const auth = new AuthService(repository, tokens);
  const hub = new RealtimeHub();
  const authLimiter = new RateLimiter(12, 60_000);

  server.get("/health", async () => ({
    status: "ok",
    version: "2.1.0",
    protocol: 2,
    storage: repository.kind,
  }));

  server.post("/auth/register", async (request, reply) => {
    authLimiter.consume(request.ip);
    const input = RegisterRequestSchema.parse(request.body);
    const session = await auth.register(input);
    return reply.code(201).send({
      accessToken: session.accessToken,
      user: toPublicUser(session.user),
    });
  });

  server.post("/auth/login", async (request) => {
    authLimiter.consume(request.ip);
    const input = LoginRequestSchema.parse(request.body);
    const session = await auth.login(input);
    return {
      accessToken: session.accessToken,
      user: toPublicUser(session.user),
    };
  });

  server.get("/bootstrap", async (request) => {
    const user = await authenticatedUser(request, auth);
    return buildBootstrap(
      repository,
      user.id,
      new Set([...hub.onlineUserIds(), user.id]),
    );
  });

  server.post("/channels", async (request, reply) => {
    const user = await authenticatedUser(request, auth);
    const input = CreateChannelSchema.parse(request.body);
    const channel = await repository.createChannel({
      ...input,
      ownerId: user.id,
    });
    const created = {
      ...channel,
      membersOnline: hub.onlineUserIds().size,
      unread: 0,
    };
    hub.broadcast({ type: "channel.created", payload: created });
    return reply.code(201).send(created);
  });

  registerRealtime(server, { repository, auth, hub });

  server.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Os dados enviados são inválidos",
        requestId: request.id,
      });
    }
    const normalized = normalizeError(error);
    if (normalized.statusCode >= 500) request.log.error(error);
    return reply.code(normalized.statusCode).send({
      code: normalized.code,
      message: normalized.message,
      requestId: request.id,
    });
  });

  server.addHook("onClose", async () => repository.close());
  return server;
}

async function authenticatedUser(request: FastifyRequest, auth: AuthService) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
  if (!token)
    throw new AppError("AUTH_REQUIRED", "Envie um token Bearer válido", 401);
  return auth.resume(token);
}

export function normalizeUsername(value: string): string {
  return UsernameSchema.parse(value);
}
