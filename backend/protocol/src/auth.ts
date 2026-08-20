import { z } from "zod";

import {
  BootstrapSchema,
  DisplayNameSchema,
  IdSchema,
  PasswordSchema,
  PublicUserSchema,
  UsernameSchema,
} from "./common.js";

export const LoginRequestSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = LoginRequestSchema.extend({
  displayName: DisplayNameSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(20),
  user: PublicUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const SessionReadySchema = z.object({
  accessToken: z.string().min(20),
  bootstrap: BootstrapSchema,
  protocolVersion: z.number().int().positive().default(2),
});
export type SessionReady = z.infer<typeof SessionReadySchema>;

export const DeleteAccountRequestSchema = z.object({
  password: PasswordSchema,
  confirmation: UsernameSchema,
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

export const DeleteAccountResponseSchema = z.object({
  deleted: z.literal(true),
  userId: IdSchema,
});
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;
