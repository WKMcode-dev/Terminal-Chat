import type { PublicUser, ServerEvent } from "@terminal-chat/protocol";

export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export class RealtimeHub {
  private readonly users = new Map<string, Set<SocketLike>>();
  private readonly rooms = new Map<string, Map<string, Set<SocketLike>>>();

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

  joinRoom(roomId: string, userId: string, socket: SocketLike): void {
    const participants =
      this.rooms.get(roomId) ?? new Map<string, Set<SocketLike>>();
    const sockets = participants.get(userId) ?? new Set<SocketLike>();
    sockets.add(socket);
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

  relayVoice(
    roomId: string,
    userId: string,
    socket: SocketLike,
    payload: { sampleRate: number; samples: string },
  ): void {
    const participants = this.rooms.get(roomId);
    if (!participants?.get(userId)?.has(socket)) return;
    const event: ServerEvent = {
      type: "voice.audio",
      payload: { roomId, userId, ...payload },
    };
    for (const sockets of participants.values()) {
      for (const peer of sockets) {
        if (peer !== socket) this.send(peer, event);
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

export function onlinePresence(user: PublicUser): PublicUser {
  return {
    ...user,
    presence: user.presence === "offline" ? "online" : user.presence,
  };
}
