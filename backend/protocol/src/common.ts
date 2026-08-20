import { z } from "zod";

export const PROTOCOL_VERSION = 3 as const;

export const IdSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime({ offset: true });
export const UsernameSchema = z
  .string()
  .trim()
  .min(3, "O usuário precisa ter pelo menos 3 caracteres")
  .max(24, "O usuário pode ter no máximo 24 caracteres")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Use apenas letras, números, ponto, hífen e sublinhado",
  )
  .transform((value) => value.toLowerCase());
export const DisplayNameSchema = z.string().trim().min(2).max(40);
export const ProfileBioSchema = z.string().trim().max(240);
export const AvatarSchema = z.string().trim().max(16);
export const PasswordSchema = z.string().min(8).max(128);
export const MessageBodySchema = z.string().trim().min(1).max(4_000);

export const PresenceSchema = z.enum(["online", "away", "busy", "offline"]);
export type Presence = z.infer<typeof PresenceSchema>;

export const PublicUserSchema = z.object({
  id: IdSchema,
  username: UsernameSchema,
  displayName: DisplayNameSchema,
  presence: PresenceSchema,
  activity: z.string().max(120).default(""),
  bio: ProfileBioSchema.default(""),
  avatar: AvatarSchema.default(""),
  createdAt: TimestampSchema,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const ChannelSchema = z.object({
  id: IdSchema,
  name: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(160),
  membersOnline: z.number().int().nonnegative(),
  unread: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
});
export type Channel = z.infer<typeof ChannelSchema>;

export const MessageScopeSchema = z.enum(["channel", "direct"]);
export type MessageScope = z.infer<typeof MessageScopeSchema>;

export const ChatMessageSchema = z.object({
  id: IdSchema,
  clientId: IdSchema.optional(),
  scope: MessageScopeSchema,
  targetId: IdSchema,
  author: PublicUserSchema,
  body: MessageBodySchema,
  createdAt: TimestampSchema,
  editedAt: TimestampSchema.optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ConversationSchema = z.object({
  contact: PublicUserSchema,
  unread: z.number().int().nonnegative(),
  messages: z.array(ChatMessageSchema),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const VoiceCodecSchema = z.enum(["f32", "pcm16"]);
export type VoiceCodec = z.infer<typeof VoiceCodecSchema>;

export const FriendshipStatusSchema = z.enum([
  "pending",
  "accepted",
  "blocked",
]);
export type FriendshipStatus = z.infer<typeof FriendshipStatusSchema>;

export const FriendshipSchema = z.object({
  id: IdSchema,
  requesterId: IdSchema,
  addresseeId: IdSchema,
  status: FriendshipStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Friendship = z.infer<typeof FriendshipSchema>;

export const BootstrapSchema = z.object({
  self: PublicUserSchema,
  channels: z.array(ChannelSchema),
  profiles: z.array(PublicUserSchema),
  conversations: z.array(ConversationSchema),
  channelMessages: z.record(IdSchema, z.array(ChatMessageSchema)),
  friendships: z.array(FriendshipSchema),
});
export type Bootstrap = z.infer<typeof BootstrapSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
