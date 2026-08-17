export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.message === "USERNAME_TAKEN") {
    return new AppError(
      "USERNAME_TAKEN",
      "Esse nome de usuário já está em uso",
      409,
    );
  }
  if (error instanceof Error && error.message === "CHANNEL_TAKEN") {
    return new AppError(
      "CHANNEL_TAKEN",
      "Já existe um canal com esse nome",
      409,
    );
  }
  if (error instanceof Error) {
    const known = {
      USER_NOT_FOUND: ["USER_NOT_FOUND", "Esse usuário não existe", 404],
      FRIEND_SELF: [
        "FRIEND_SELF",
        "Você não pode realizar essa ação consigo mesmo",
        400,
      ],
      USER_BLOCKED: [
        "USER_BLOCKED",
        "A solicitação não pode ser enviada por causa de um bloqueio",
        403,
      ],
      FRIENDSHIP_EXISTS: ["FRIENDSHIP_EXISTS", "Vocês já são amigos", 409],
      FRIEND_REQUEST_EXISTS: [
        "FRIEND_REQUEST_EXISTS",
        "Já existe uma solicitação de amizade pendente",
        409,
      ],
      FRIEND_REQUEST_NOT_FOUND: [
        "FRIEND_REQUEST_NOT_FOUND",
        "A solicitação de amizade não existe",
        404,
      ],
    } satisfies Record<string, [string, string, number]>;
    const normalized = known[error.message as keyof typeof known];
    if (normalized) return new AppError(...normalized);
  }
  return new AppError(
    "INTERNAL_ERROR",
    "O servidor não conseguiu concluir a operação",
    500,
  );
}
