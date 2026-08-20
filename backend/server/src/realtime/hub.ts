import type {
  PublicUser,
  ServerEvent,
  VoiceCodec,
} from "@terminal-chat/protocol";

export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export class RealtimeHub {
  private readonly users = new Map<string, Set<SocketLike>>();
  private readonly rooms = new Map<string, Map<string, Set<SocketLike>>>();
  private readonly voiceCodecs = new WeakMap<SocketLike, VoiceCodec>();

  add(userId: string, socket: SocketLike): void {
    const sockets = this.users.get(userId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.users.set(userId, sockets);
  }

  remove(userId: string, socket: SocketLike): boolean {
    const sockets = this.users.get(userId);
    sockets?.delete(socket);
    if (sockets?.size === 0) this.users.delete(userId);
    this.leaveAll(userId, socket);
    return this.users.has(userId);
  }

  onlineUserIds(): Set<string> {
    return new Set(this.users.keys());
  }

  broadcast(event: ServerEvent): void {
    for (const sockets of this.users.values()) this.sendSockets(sockets, event);
  }

  sendUsers(userIds: Iterable<string>, event: ServerEvent): void {
    for (const userId of new Set(userIds)) {
      const sockets = this.users.get(userId);
      if (sockets) this.sendSockets(sockets, event);
    }
  }

  closeUser(userId: string, code = 1000, reason = "session-ended"): void {
    const sockets = [...(this.users.get(userId) ?? [])];
    for (const socket of sockets) socket.close(code, reason);
  }

  joinRoom(
    roomId: string,
    userId: string,
    socket: SocketLike,
    codec: VoiceCodec = "f32",
  ): void {
    const participants =
      this.rooms.get(roomId) ?? new Map<string, Set<SocketLike>>();
    const sockets = participants.get(userId) ?? new Set<SocketLike>();
    sockets.add(socket);
    this.voiceCodecs.set(socket, codec);
    participants.set(userId, sockets);
    this.rooms.set(roomId, participants);
    this.broadcastRoomState(roomId);
  }

  leaveRoom(roomId: string, userId: string, socket: SocketLike): void {
    const participants = this.rooms.get(roomId);
    const sockets = participants?.get(userId);
    sockets?.delete(socket);
    if (sockets?.size === 0) participants?.delete(userId);
    if (participants?.size === 0) this.rooms.delete(roomId);
    else this.broadcastRoomState(roomId);
  }

  closeRoom(roomId: string): void {
    const participants = this.rooms.get(roomId);
    if (!participants) return;
    const event: ServerEvent = {
      type: "voice.state",
      payload: { roomId, participantIds: [] },
    };
    for (const sockets of participants.values())
      this.sendSockets(sockets, event);
    this.rooms.delete(roomId);
  }

  relayVoice(
    roomId: string,
    userId: string,
    socket: SocketLike,
    payload: { sampleRate: number; samples: string },
    codec: VoiceCodec = "f32",
  ): void {
    const participants = this.rooms.get(roomId);
    if (!participants?.get(userId)?.has(socket)) return;
    for (const sockets of participants.values()) {
      for (const peer of sockets) {
        if (peer === socket) continue;
        const targetCodec = this.voiceCodecs.get(peer) ?? "f32";
        const converted = transcodeVoice(payload.samples, codec, targetCodec);
        this.send(peer, {
          type: "voice.audio",
          payload: {
            roomId,
            userId,
            sampleRate: payload.sampleRate,
            codec: targetCodec,
            samples: converted,
          },
        });
      }
    }
  }

  private leaveAll(userId: string, socket: SocketLike): void {
    for (const roomId of [...this.rooms.keys()])
      this.leaveRoom(roomId, userId, socket);
  }

  private broadcastRoomState(roomId: string): void {
    const participants = this.rooms.get(roomId);
    if (!participants) return;
    const event: ServerEvent = {
      type: "voice.state",
      payload: { roomId, participantIds: [...participants.keys()] },
    };
    for (const sockets of participants.values())
      this.sendSockets(sockets, event);
  }

  private sendSockets(sockets: Iterable<SocketLike>, event: ServerEvent): void {
    for (const socket of sockets) this.send(socket, event);
  }

  private send(socket: SocketLike, event: ServerEvent): void {
    if (socket.readyState === 1) socket.send(JSON.stringify(event));
  }
}

function transcodeVoice(
  samples: string,
  sourceCodec: VoiceCodec,
  targetCodec: VoiceCodec,
): string {
  if (sourceCodec === targetCodec) return samples;
  const source = Buffer.from(samples, "base64");
  if (sourceCodec === "f32") {
    const target = Buffer.allocUnsafe((source.byteLength / 4) * 2);
    for (
      let read = 0, write = 0;
      read + 3 < source.length;
      read += 4, write += 2
    ) {
      const value = source.readFloatLE(read);
      target.writeInt16LE(
        Math.round(Math.max(-1, Math.min(1, value)) * 32_767),
        write,
      );
    }
    return target.toString("base64");
  }
  const target = Buffer.allocUnsafe((source.byteLength / 2) * 4);
  for (
    let read = 0, write = 0;
    read + 1 < source.length;
    read += 2, write += 4
  ) {
    target.writeFloatLE(source.readInt16LE(read) / 32_768, write);
  }
  return target.toString("base64");
}

export function onlinePresence(user: PublicUser): PublicUser {
  return {
    ...user,
    presence: user.presence === "offline" ? "online" : user.presence,
  };
}
