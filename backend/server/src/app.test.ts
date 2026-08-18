import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { ServerEventSchema } from "@terminal-chat/protocol";

import { buildServer } from "./app.js";
import type { ServerConfig } from "./config.js";

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("Terminal Chat server", () => {
  it("registers, logs in and returns a real persisted bootstrap", async () => {
    const { server, dataFile } = await testServer();
    const register = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "Kenneth",
        displayName: "Kenneth Kitsune",
        password: "senha-segura-123",
      },
    });
    expect(register.statusCode).toBe(201);
    const { accessToken } = register.json<{ accessToken: string }>();

    const login = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "kenneth", password: "senha-segura-123" },
    });
    expect(login.statusCode).toBe(200);

    const bootstrap = await server.inject({
      method: "GET",
      url: "/bootstrap",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(bootstrap.statusCode).toBe(200);
    expect(bootstrap.json().channels[0].name).toBe("geral");
    expect(bootstrap.json().self.displayName).toBe("Kenneth Kitsune");
    expect(bootstrap.json().self.bio).toBe("");
    expect(bootstrap.json().friendships).toEqual([]);
    expect(JSON.parse(await readFile(dataFile, "utf8")).users).toHaveLength(1);
  });

  it("rejects duplicate accounts and invalid credentials", async () => {
    const { server } = await testServer();
    const payload = {
      username: "naki",
      displayName: "Naki",
      password: "senha-segura-123",
    };
    expect(
      (await server.inject({ method: "POST", url: "/auth/register", payload }))
        .statusCode,
    ).toBe(201);
    expect(
      (await server.inject({ method: "POST", url: "/auth/register", payload }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/auth/login",
          payload: { username: "naki", password: "senha-incorreta" },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("protects private endpoints", async () => {
    const { server } = await testServer();
    expect(
      (await server.inject({ method: "GET", url: "/bootstrap" })).statusCode,
    ).toBe(401);
  });

  it("authenticates a WebSocket and persists a realtime message", async () => {
    const { server } = await testServer();
    const register = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "caue",
        displayName: "Cauê",
        password: "senha-segura-123",
      },
    });
    const { accessToken } = register.json<{ accessToken: string }>();
    const socket = (await server.injectWS("/ws")) as unknown as TestSocket;
    socket.send(
      JSON.stringify({ type: "auth.resume", payload: { accessToken } }),
    );
    const ready = ServerEventSchema.parse(await nextSocketEvent(socket));
    expect(ready.type).toBe("session.ready");
    if (ready.type !== "session.ready")
      throw new Error("Sessão WebSocket não confirmada");
    const channelId = ready.payload.bootstrap.channels[0]!.id;

    const pong = nextSocketEventOfType(socket, "pong");
    socket.send(
      JSON.stringify({
        type: "ping",
        payload: { sentAt: "2026-08-18T12:00:00.000Z" },
      }),
    );
    expect((await pong).payload.sentAt).toBe("2026-08-18T12:00:00.000Z");

    socket.send(
      JSON.stringify({
        type: "message.send",
        payload: {
          clientId: "00000000-0000-4000-8000-000000000099",
          scope: "channel",
          targetId: channelId,
          body: "Mensagem real com acentuação: está funcionando? 🦊",
        },
      }),
    );
    let created = ServerEventSchema.parse(await nextSocketEvent(socket));
    if (created.type === "presence.changed") {
      created = ServerEventSchema.parse(await nextSocketEvent(socket));
    }
    expect(created.type).toBe("message.created");
    if (created.type === "message.created") {
      expect(created.payload.body).toContain("acentuação");
    }
    socket.close();
  });

  it("synchronizes profiles and friendships between two realtime clients", async () => {
    const { server } = await testServer();
    const kennethToken = await registerUser(server, {
      username: "kenneth-social",
      displayName: "Kenneth",
    });
    const nakiToken = await registerUser(server, {
      username: "naki-social",
      displayName: "Naki",
    });
    const kennethSocket = (await server.injectWS(
      "/ws",
    )) as unknown as TestSocket;
    const nakiSocket = (await server.injectWS("/ws")) as unknown as TestSocket;
    kennethSocket.send(
      JSON.stringify({
        type: "auth.resume",
        payload: { accessToken: kennethToken },
      }),
    );
    const kennethReady = await nextSocketEventOfType(
      kennethSocket,
      "session.ready",
    );
    nakiSocket.send(
      JSON.stringify({
        type: "auth.resume",
        payload: { accessToken: nakiToken },
      }),
    );
    const nakiReady = await nextSocketEventOfType(nakiSocket, "session.ready");
    const kennethId = kennethReady.payload.bootstrap.self.id;
    const nakiId = nakiReady.payload.bootstrap.self.id;

    const profileOnKenneth = nextSocketEventOfType(
      kennethSocket,
      "profile.updated",
    );
    const profileOnNaki = nextSocketEventOfType(nakiSocket, "profile.updated");
    kennethSocket.send(
      JSON.stringify({
        type: "profile.update",
        payload: {
          displayName: "Kenneth Kitsune",
          bio: "Raposa do terminal",
          avatar: "🦊",
          activity: "Programando",
        },
      }),
    );
    expect((await profileOnKenneth).payload.avatar).toBe("🦊");
    expect((await profileOnNaki).payload.displayName).toBe("Kenneth Kitsune");

    const requestOnKenneth = nextSocketEventOfType(
      kennethSocket,
      "friendship.changed",
    );
    const requestOnNaki = nextSocketEventOfType(
      nakiSocket,
      "friendship.changed",
    );
    kennethSocket.send(
      JSON.stringify({
        type: "friend.request",
        payload: { userId: nakiId },
      }),
    );
    const request = await requestOnKenneth;
    expect(request.payload.status).toBe("pending");
    expect((await requestOnNaki).payload.requesterId).toBe(kennethId);

    const acceptedOnKenneth = nextSocketEventOfType(
      kennethSocket,
      "friendship.changed",
    );
    const acceptedOnNaki = nextSocketEventOfType(
      nakiSocket,
      "friendship.changed",
    );
    nakiSocket.send(
      JSON.stringify({
        type: "friend.respond",
        payload: { friendshipId: request.payload.id, action: "accept" },
      }),
    );
    expect((await acceptedOnKenneth).payload.status).toBe("accepted");
    expect((await acceptedOnNaki).payload.status).toBe("accepted");
    kennethSocket.close();
    nakiSocket.close();
  });
});

interface TestSocket {
  send(payload: string): void;
  close(): void;
  once(
    event: "message",
    listener: (data: { toString(): string }) => void,
  ): void;
}

function nextSocketEvent(socket: TestSocket): Promise<unknown> {
  return new Promise((resolve) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString())));
  });
}

function nextSocketEventOfType<T extends string>(
  socket: TestSocket,
  type: T,
): Promise<Extract<ReturnType<typeof ServerEventSchema.parse>, { type: T }>> {
  return new Promise((resolve) => {
    const wait = () => {
      socket.once("message", (data) => {
        const event = ServerEventSchema.parse(JSON.parse(data.toString()));
        if (event.type === type) {
          resolve(
            event as Extract<
              ReturnType<typeof ServerEventSchema.parse>,
              { type: T }
            >,
          );
        } else {
          wait();
        }
      });
    };
    wait();
  });
}

async function registerUser(
  server: Awaited<ReturnType<typeof buildServer>>,
  input: { username: string; displayName: string },
): Promise<string> {
  const response = await server.inject({
    method: "POST",
    url: "/auth/register",
    payload: { ...input, password: "senha-segura-123" },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ accessToken: string }>().accessToken;
}

async function testServer() {
  const directory = await mkdtemp(join(tmpdir(), "terminal-chat-test-"));
  const dataFile = join(directory, "data.json");
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 3000,
    jwtSecret: "test-secret-with-enough-entropy-for-tests",
    corsOrigins: ["http://localhost:5173"],
    dataFile,
    isProduction: false,
  };
  const server = await buildServer({ config, logger: false });
  servers.push(server);
  return { server, dataFile };
}
