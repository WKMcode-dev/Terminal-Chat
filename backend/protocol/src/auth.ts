import { z } from "zod";

import {
  BootstrapSchema,
  DisplayNameSchema,
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
});
export type SessionReady = z.infer<typeof SessionReadySchema>;
