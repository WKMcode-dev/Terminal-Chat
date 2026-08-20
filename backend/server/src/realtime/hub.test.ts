import { describe, expect, it } from "vitest";

import { RealtimeHub, type SocketLike } from "./hub.js";

class FakeSocket implements SocketLike {
  readonly readyState = 1;
  readonly messages: unknown[] = [];

  send(data: string): void {
    this.messages.push(JSON.parse(data));
  }

  close(): void {}
}

describe("Realtime voice hub", () => {
  it("relays audio only to other participants in the same room", () => {
    const hub = new RealtimeHub();
    const kenneth = new FakeSocket();
    const naki = new FakeSocket();
    const outsider = new FakeSocket();
    hub.add("00000000-0000-4000-8000-000000000001", kenneth);
    hub.add("00000000-0000-4000-8000-000000000002", naki);
    hub.add("00000000-0000-4000-8000-000000000003", outsider);
    hub.joinRoom(
      "channel:room",
      "00000000-0000-4000-8000-000000000001",
      kenneth,
    );
    hub.joinRoom("channel:room", "00000000-0000-4000-8000-000000000002", naki);
    kenneth.messages.length = 0;
    naki.messages.length = 0;
    outsider.messages.length = 0;

    hub.relayVoice(
      "channel:room",
      "00000000-0000-4000-8000-000000000001",
      kenneth,
      { sampleRate: 48_000, samples: "AAAAAA==" },
    );

    expect(kenneth.messages).toHaveLength(0);
    expect(naki.messages).toMatchObject([
      { type: "voice.audio", payload: { sampleRate: 48_000 } },
    ]);
    expect(outsider.messages).toHaveLength(0);
  });

  it("transcodes legacy float audio to compact PCM16 for updated clients", () => {
    const hub = new RealtimeHub();
    const legacy = new FakeSocket();
    const compact = new FakeSocket();
    hub.joinRoom(
      "channel:voice",
      "00000000-0000-4000-8000-000000000001",
      legacy,
    );
    hub.joinRoom(
      "channel:voice",
      "00000000-0000-4000-8000-000000000002",
      compact,
      "pcm16",
    );
    legacy.messages.length = 0;
    compact.messages.length = 0;
    const input = Buffer.allocUnsafe(4);
    input.writeFloatLE(0.5);

    hub.relayVoice(
      "channel:voice",
      "00000000-0000-4000-8000-000000000001",
      legacy,
      { sampleRate: 24_000, samples: input.toString("base64") },
      "f32",
    );

    const event = compact.messages[0] as {
      payload: { codec: string; samples: string };
    };
    expect(event.payload.codec).toBe("pcm16");
    expect(Buffer.from(event.payload.samples, "base64")).toHaveLength(2);
  });
});
