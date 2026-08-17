import {
  ClientEventSchema,
  ServerEventSchema,
  type ClientEvent,
  type ServerEvent,
} from "@terminal-chat/protocol";

import { WS_URL } from "./api";

type Listener = (event: ServerEvent) => void;

export class RealtimeClient {
  private accessToken: string;
  private socket?: WebSocket;
  private reconnectTimer?: number;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private readonly listeners = new Set<Listener>();
  private readonly joinedRooms = new Set<string>();

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  connect(): void {
    this.manuallyClosed = false;
    this.openSocket();
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.socket?.close(1000, "logout");
    this.socket = undefined;
    this.joinedRooms.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(event: ClientEvent): boolean {
    const parsed = ClientEventSchema.safeParse(event);
    if (!parsed.success || this.socket?.readyState !== WebSocket.OPEN)
      return false;
    if (parsed.data.type === "voice.join")
      this.joinedRooms.add(parsed.data.payload.roomId);
    if (parsed.data.type === "voice.leave")
      this.joinedRooms.delete(parsed.data.payload.roomId);
    this.socket.send(JSON.stringify(parsed.data));
    return true;
  }

  private openSocket(): void {
    const socket = new WebSocket(WS_URL);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.send({
        type: "auth.resume",
        payload: { accessToken: this.accessToken },
      });
    });
    socket.addEventListener("message", (message) => {
      if (typeof message.data !== "string") return;
      const decoded = ServerEventSchema.safeParse(safeJson(message.data));
      if (!decoded.success) return;
      if (decoded.data.type === "session.ready") {
        this.accessToken = decoded.data.payload.accessToken;
        sessionStorage.setItem("terminal-chat-token", this.accessToken);
        for (const roomId of this.joinedRooms) {
          this.send({ type: "voice.join", payload: { roomId } });
        }
      }
      for (const listener of this.listeners) listener(decoded.data);
    });
    socket.addEventListener("close", () => this.scheduleReconnect());
    socket.addEventListener("error", () => socket.close());
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed) return;
    const wait = Math.min(10_000, 500 * 2 ** this.reconnectAttempt++);
    this.emit({
      type: "error",
      payload: { code: "RECONNECTING", message: "Reconectando ao servidor..." },
    });
    this.reconnectTimer = window.setTimeout(() => this.openSocket(), wait);
  }

  private emit(event: ServerEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
