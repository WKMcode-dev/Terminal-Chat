import { hash, verify } from "argon2";

import type { LoginRequest, RegisterRequest } from "@terminal-chat/protocol";

import { AppError } from "../errors.js";
import type { Repository, StoredUser } from "../storage/index.js";

interface TokenProvider {
  sign(payload: { sub: string; username: string }): string;
  verify<T extends { sub: string }>(token: string): T;
}

export class AuthService {
  private readonly dummyHash = hash("terminal-chat-dummy-password");

  constructor(
    private readonly repository: Repository,
    private readonly tokens: TokenProvider,
  ) {}

  async register(
    input: RegisterRequest,
  ): Promise<{ accessToken: string; user: StoredUser }> {
    const passwordHash = await hash(input.password, {
      type: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const user = await this.repository.createUser({
      username: input.username,
      displayName: input.displayName,
      passwordHash,
    });
    return { accessToken: this.createToken(user), user };
  }

  async login(
    input: LoginRequest,
  ): Promise<{ accessToken: string; user: StoredUser }> {
    const user = await this.repository.findUserByUsername(input.username);
    const passwordHash = user?.passwordHash ?? (await this.dummyHash);
    const valid = await verify(passwordHash, input.password);
    if (!user || !valid) {
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Usuário ou senha inválidos",
        401,
      );
    }
    return { accessToken: this.createToken(user), user };
  }

  async resume(accessToken: string): Promise<StoredUser> {
    let payload: { sub: string };
    try {
      payload = this.tokens.verify<{ sub: string }>(accessToken);
    } catch {
      throw new AppError(
        "INVALID_SESSION",
        "A sessão expirou; entre novamente",
        401,
      );
    }
    const user = await this.repository.findUserById(payload.sub);
    if (!user)
      throw new AppError(
        "INVALID_SESSION",
        "A conta desta sessão não existe",
        401,
      );
    return user;
  }

  createToken(user: StoredUser): string {
    return this.tokens.sign({ sub: user.id, username: user.username });
  }
}
