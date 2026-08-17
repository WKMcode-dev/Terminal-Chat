import {
  ApiErrorSchema,
  AuthResponseSchema,
  BootstrapSchema,
  ChannelSchema,
  type AuthResponse,
  type Bootstrap,
  type Channel,
  type LoginRequest,
  type RegisterRequest,
} from "@terminal-chat/protocol";

export const API_BASE = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");
export const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const api = {
  login(input: LoginRequest): Promise<AuthResponse> {
    return request(
      "/auth/login",
      { method: "POST", body: input },
      AuthResponseSchema.parse,
    );
  },

  register(input: RegisterRequest): Promise<AuthResponse> {
    return request(
      "/auth/register",
      { method: "POST", body: input },
      AuthResponseSchema.parse,
    );
  },

  bootstrap(token: string): Promise<Bootstrap> {
    return request("/bootstrap", { token }, BootstrapSchema.parse);
  },

  createChannel(
    token: string,
    input: { name: string; description: string },
  ): Promise<Channel> {
    return request(
      "/channels",
      { method: "POST", token, body: input },
      ChannelSchema.parse,
    );
  },
};

interface RequestOptions {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
}

async function request<T>(
  path: string,
  options: RequestOptions,
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(payload);
    throw new ApiRequestError(
      error.success ? error.data.code : "REQUEST_FAILED",
      error.success
        ? error.data.message
        : "O servidor não respondeu corretamente",
      response.status,
    );
  }
  return parse(payload);
}
