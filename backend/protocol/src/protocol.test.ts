import { describe, expect, it } from "vitest";

import {
  ClientEventSchema,
  MessageBodySchema,
  UsernameSchema,
} from "./index.js";

describe("Terminal Chat protocol", () => {
  it("normalizes valid usernames", () => {
    expect(UsernameSchema.parse("Kenneth.Kitsune")).toBe("kenneth.kitsune");
  });

  it("preserves UTF-8 message content", () => {
    expect(MessageBodySchema.parse("Olá! Bora jogar? 🦊")).toBe(
      "Olá! Bora jogar? 🦊",
    );
  });

  it("rejects malformed and oversized realtime events", () => {
    expect(() =>
      ClientEventSchema.parse({ type: "message.send", payload: { body: "" } }),
    ).toThrow();
    expect(() => MessageBodySchema.parse("a".repeat(4_001))).toThrow();
  });

  it("validates a cross-client voice frame", () => {
    const event = ClientEventSchema.parse({
      type: "voice.audio",
      payload: {
        roomId: "channel:test",
        sampleRate: 48_000,
        samples: "AAAAAA==",
      },
    });
    expect(event.type).toBe("voice.audio");
    expect(() =>
      ClientEventSchema.parse({
        type: "voice.audio",
        payload: {
          roomId: "channel:test",
          sampleRate: 100,
          samples: "AAAAAA==",
        },
      }),
    ).toThrow();
  });

  it("validates profile and friendship actions", () => {
    expect(
      ClientEventSchema.parse({
        type: "profile.update",
        payload: {
          displayName: "Kenneth Kitsune",
          bio: "Desenvolvedor e raposa do terminal 🦊",
          avatar: "🦊",
          activity: "Testando o Terminal Chat",
        },
      }).type,
    ).toBe("profile.update");
    expect(
      ClientEventSchema.parse({
        type: "friend.request",
        payload: { userId: "00000000-0000-4000-8000-000000000002" },
      }).type,
    ).toBe("friend.request");
  });

  it("requires a password and username confirmation to delete an account", () => {
    const event = ClientEventSchema.parse({
      type: "account.delete",
      payload: {
        password: "senha-segura-123",
        confirmation: "@Kenneth".slice(1),
      },
    });
    expect(event.type).toBe("account.delete");
    if (event.type === "account.delete") {
      expect(event.payload.confirmation).toBe("kenneth");
    }
  });
});
