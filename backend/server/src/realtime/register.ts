import type { FastifyInstance } from "fastify";

import {
  ClientEventSchema,
  type ClientEvent,
  type ServerEvent,
} from "@terminal-chat/protocol";

import { AppError, normalizeError } from "../errors.js";
import type { Repository, StoredUser } from "../storage/index.js";
import { toChatMessage, toPublicUser } from "../storage/index.js";
import type { AuthService } from "../services/auth-service.js";
import { buildBootstrap } from "../services/bootstrap-service.js";
import { RateLimiter } from "../services/rate-limiter.js";
import { onlinePresence, RealtimeHub, type SocketLike } from "./hub.js";

interface RawSocket extends SocketLike {
  on(event: "message", listener: (data: { toString(): string }) => void): void;
  on(event: "close" | "error", listener: () => void): void;
}

interface RealtimeDependencies {
  repository: Repository;
  auth: AuthService;
  hub: RealtimeHub;
}

export function registerRealtime(
  server: FastifyInstance,
  dependencies: RealtimeDependencies,
): void {
  const { repository, auth, hub } = dependencies;
  const authLimiter = new RateLimiter(8, 60_000);
  const messageLimiter = new RateLimiter(30, 10_000);
  const audioLimiter = new RateLimiter(2_000_000, 1_000);
  const socialLimiter = new RateLimiter(30, 60_000);

  server.get("/ws", { websocket: true }, (nativeSocket, request) => {
    const socket = nativeSocket as RawSocket;
    let currentUser: StoredUser | undefined;
    let closed = false;

    socket.on("message", (raw) => {
      void handleRawEvent(raw.toString()).catch((error) =>
        sendError(socket, error, request.id),
      );
    });
    socket.on("close", () => void disconnect());
    socket.on("error", () => void disconnect());

    async function handleRawEvent(raw: string): Promise<void> {
      if (Buffer.byteLength(raw, "utf8") > 512_000) {
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          "O evento ultrapassou o limite permitido",
          413,
        );
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(raw);
      } catch {
        throw new AppError("INVALID_JSON", "O evento não contém JSON válido");
      }
      const parsed = ClientEventSchema.safeParse(decoded);
      if (!parsed.success)
        throw new AppError(
          "INVALID_EVENT",
          "Evento inválido para o protocolo v2",
        );

      if (parsed.data.type.startsWith("auth.")) {
        await authenticate(parsed.data);
        return;
      }
      if (!currentUser)
        throw new AppError(
          "AUTH_REQUIRED",
          "Autentique a conexão primeiro",
          401,
        );
      await handleAuthenticatedEvent(parsed.data, currentUser);
    }

    async function authenticate(event: ClientEvent): Promise<void> {
      if (currentUser)
        throw new AppError(
          "ALREADY_AUTHENTICATED",
          "A conexão já está autenticada",
        );
      authLimiter.consume(request.ip);

      let accessToken: string;
      let user: StoredUser;
      if (event.type === "auth.login") {
        const session = await auth.login(event.payload);
        accessToken = session.accessToken;
        user = session.user;
      } else if (event.type === "auth.register") {
        const session = await auth.register(event.payload);
        accessToken = session.accessToken;
        user = session.user;
      } else if (event.type === "auth.resume") {
        accessToken = event.payload.accessToken;
        user = await auth.resume(accessToken);
      } else {
        throw new AppError(
          "AUTH_REQUIRED",
          "Autentique a conexão primeiro",
          401,
        );
      }

      currentUser = await repository.updatePresence(
        user.id,
        "online",
        user.activity,
      );
      hub.add(currentUser.id, socket);
      const bootstrap = await buildBootstrap(
        repository,
        currentUser.id,
        hub.onlineUserIds(),
      );
      send(socket, {
        type: "session.ready",
        payload: { accessToken, bootstrap },
      });
      hub.broadcast({
        type: "presence.changed",
        payload: onlinePresence(toPublicUser(currentUser)),
      });
    }

    async function handleAuthenticatedEvent(
      event: ClientEvent,
      user: StoredUser,
    ): Promise<void> {
      switch (event.type) {
        case "message.send":
          await createMessage(event, user);
          break;
        case "presence.update": {
          currentUser = await repository.updatePresence(
            user.id,
            event.payload.presence,
            event.payload.activity,
          );
          hub.broadcast({
            type: "presence.changed",
            payload: toPublicUser(currentUser),
          });
          break;
        }
        case "profile.update": {
          socialLimiter.consume(user.id);
          currentUser = await repository.updateProfile(user.id, event.payload);
          hub.broadcast({
            type: "profile.updated",
            payload: toPublicUser(currentUser),
          });
          break;
        }
        case "friend.request": {
          socialLimiter.consume(user.id);
          const friendship = await repository.createFriendRequest(
            user.id,
            event.payload.userId,
          );
          hub.sendUsers([friendship.requesterId, friendship.addresseeId], {
            type: "friendship.changed",
            payload: friendship,
          });
          break;
        }
        case "friend.respond": {
          socialLimiter.consume(user.id);
          const existing = (
            await repository.listFriendshipsForUser(user.id)
          ).find((friendship) => friendship.id === event.payload.friendshipId);
          if (!existing)
            throw new AppError(
              "FRIEND_REQUEST_NOT_FOUND",
              "A solicitação de amizade não existe",
              404,
            );
          const friendship = await repository.respondFriendRequest(
            user.id,
            event.payload.friendshipId,
            event.payload.action,
          );
          if (friendship) {
            hub.sendUsers([friendship.requesterId, friendship.addresseeId], {
              type: "friendship.changed",
              payload: friendship,
            });
          } else {
            hub.sendUsers([existing.requesterId, existing.addresseeId], {
              type: "friendship.removed",
              payload: {
                userId: existing.requesterId,
                otherUserId: existing.addresseeId,
              },
            });
          }
          break;
        }
        case "friend.remove": {
          socialLimiter.consume(user.id);
          if (
            !(await repository.removeFriendship(user.id, event.payload.userId))
          ) {
            throw new AppError(
              "FRIENDSHIP_NOT_FOUND",
              "A amizade ou bloqueio não existe",
              404,
            );
          }
          hub.sendUsers([user.id, event.payload.userId], {
            type: "friendship.removed",
            payload: { userId: user.id, otherUserId: event.payload.userId },
          });
          break;
        }
        case "friend.block": {
          socialLimiter.consume(user.id);
          const friendship = await repository.blockUser(
            user.id,
            event.payload.userId,
          );
          hub.sendUsers([friendship.requesterId, friendship.addresseeId], {
            type: "friendship.changed",
            payload: friendship,
          });
          break;
        }
        case "account.delete": {
          socialLimiter.consume(user.id);
          await auth.deleteAccount(user.id, event.payload);
          hub.sendUsers([user.id], {
            type: "account.deleted",
            payload: { deleted: true, userId: user.id },
          });
          hub.broadcast({
            type: "profile.removed",
            payload: { userId: user.id },
          });
          currentUser = undefined;
          hub.closeUser(user.id, 1000, "account-deleted");
          break;
        }
        case "typing.update":
          await publishTyping(event, user);
          break;
        case "voice.join":
          await validateVoiceRoom(repository, user.id, event.payload.roomId);
          hub.joinRoom(event.payload.roomId, user.id, socket);
          break;
        case "voice.leave":
          hub.leaveRoom(event.payload.roomId, user.id, socket);
          break;
        case "voice.audio": {
          const bytes = Buffer.from(event.payload.samples, "base64");
          if (
            bytes.byteLength === 0 ||
            bytes.byteLength % 4 !== 0 ||
            bytes.byteLength > 262_144
          ) {
            throw new AppError("INVALID_AUDIO", "O bloco de áudio é inválido");
          }
          audioLimiter.consume(
            `${user.id}:${event.payload.roomId}`,
            bytes.byteLength,
          );
          hub.relayVoice(event.payload.roomId, user.id, socket, event.payload);
          break;
        }
        case "ping":
          send(socket, {
            type: "pong",
            payload: { sentAt: event.payload.sentAt },
          });
          break;
        default:
          throw new AppError(
            "INVALID_EVENT",
            "Evento indisponível após a autenticação",
          );
      }
    }

    async function createMessage(
      event: Extract<ClientEvent, { type: "message.send" }>,
      user: StoredUser,
    ): Promise<void> {
      messageLimiter.consume(user.id);
      const { scope, targetId } = event.payload;
      if (
        scope === "channel" &&
        !(await repository.isChannelMember(user.id, targetId))
      ) {
        throw new AppError(
          "CHANNEL_FORBIDDEN",
          "Você não participa desse canal",
          403,
        );
      }
      if (scope === "direct") {
        if (!(await repository.findUserById(targetId))) {
          throw new AppError(
            "USER_NOT_FOUND",
            "O destinatário não existe",
            404,
          );
        }
        if (await isBlockedBetween(repository, user.id, targetId)) {
          throw new AppError(
            "DIRECT_BLOCKED",
            "A conversa está indisponível por causa de um bloqueio",
            403,
          );
        }
      }
      const stored = await repository.createMessage({
        ...event.payload,
        authorId: user.id,
      });
      const message = toChatMessage(stored, user);
      const outgoing: ServerEvent = {
        type: "message.created",
        payload: message,
      };

      if (scope === "direct") {
        hub.sendUsers([user.id, targetId], outgoing);
      } else {
        const onlineIds = [...hub.onlineUserIds()];
        const members = await Promise.all(
          onlineIds.map(async (id) =>
            (await repository.isChannelMember(id, targetId)) ? id : undefined,
          ),
        );
        hub.sendUsers(
          members.filter((id): id is string => Boolean(id)),
          outgoing,
        );
      }
    }

    async function publishTyping(
      event: Extract<ClientEvent, { type: "typing.update" }>,
      user: StoredUser,
    ): Promise<void> {
      const outgoing: ServerEvent = {
        type: "typing.changed",
        payload: { userId: user.id, ...event.payload },
      };
      if (event.payload.scope === "direct")
        hub.sendUsers([event.payload.targetId], outgoing);
      else hub.broadcast(outgoing);
    }

    async function disconnect(): Promise<void> {
      if (closed) return;
      closed = true;
      if (!currentUser) return;
      const userId = currentUser.id;
      currentUser = undefined;
      const stillOnline = hub.remove(userId, socket);
      if (!stillOnline && (await repository.findUserById(userId))) {
        const offline = await repository.updatePresence(userId, "offline", "");
        hub.broadcast({
          type: "presence.changed",
          payload: toPublicUser(offline),
        });
      }
    }
  });
}

function send(socket: SocketLike, event: ServerEvent): void {
  if (socket.readyState === 1) socket.send(JSON.stringify(event));
}

function sendError(
  socket: SocketLike,
  error: unknown,
  requestId: string,
): void {
  const normalized = normalizeError(error);
  send(socket, {
    type: "error",
    payload: { code: normalized.code, message: normalized.message, requestId },
  });
}

async function validateVoiceRoom(
  repository: Repository,
  userId: string,
  roomId: string,
): Promise<void> {
  const channelMatch = /^channel:([0-9a-f-]{36})$/i.exec(roomId);
  if (
    channelMatch?.[1] &&
    (await repository.isChannelMember(userId, channelMatch[1]))
  )
    return;

  const directMatch = /^direct:([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(roomId);
  if (directMatch?.[1] && directMatch[2]) {
    const ids = [directMatch[1], directMatch[2]];
    const otherUserId = ids.find((id) => id !== userId);
    if (
      ids.includes(userId) &&
      otherUserId &&
      (await repository.findUserById(otherUserId)) &&
      !(await isBlockedBetween(repository, userId, otherUserId))
    )
      return;
  }
  throw new AppError(
    "VOICE_ROOM_FORBIDDEN",
    "Sala de voz inválida ou sem permissão",
    403,
  );
}

async function isBlockedBetween(
  repository: Repository,
  userId: string,
  otherUserId: string,
): Promise<boolean> {
  return (await repository.listFriendshipsForUser(userId)).some(
    (friendship) =>
      friendship.status === "blocked" &&
      ((friendship.requesterId === userId &&
        friendship.addresseeId === otherUserId) ||
        (friendship.requesterId === otherUserId &&
          friendship.addresseeId === userId)),
  );
}
