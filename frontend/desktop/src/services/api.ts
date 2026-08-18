import {
  ApiErrorSchema,
  DeleteAccountResponseSchema,
  AuthResponseSchema,
  BootstrapSchema,
  ChannelSchema,
  type AuthResponse,
  type Bootstrap,
  type Channel,
  type DeleteAccountRequest,
  type DeleteAccountResponse,
  type LoginRequest,
  type RegisterRequest,
} from "@terminal-chat/protocol";

import { getServerHttpUrl } from "./serverConfig";

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

  deleteAccount(
    token: string,
    input: DeleteAccountRequest,
  ): Promise<DeleteAccountResponse> {
    return request(
      "/account",
      { method: "DELETE", token, body: input },
      DeleteAccountResponseSchema.parse,
    );
  },
};

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  token?: string;
  body?: unknown;
}

async function request<T>(
  path: string,
  options: RequestOptions,
  parse: (value: unknown) => T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getServerHttpUrl()}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(75_000),
    });
  } catch (reason) {
    const message =
      reason instanceof DOMException && reason.name === "TimeoutError"
        ? "O servidor demorou para responder. Ele pode estar despertando; tente novamente."
        : "Não foi possível alcançar o servidor configurado";
    throw new ApiRequestError("SERVER_UNREACHABLE", message, 0);
  }
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
