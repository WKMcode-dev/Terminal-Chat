import { z } from "zod";

import {
  DeleteAccountRequestSchema,
  DeleteAccountResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  SessionReadySchema,
} from "./auth.js";
import {
  ApiErrorSchema,
  ChannelSchema,
  ChatMessageSchema,
  ConversationSchema,
  IdSchema,
  MessageBodySchema,
  MessageScopeSchema,
  AvatarSchema,
  DisplayNameSchema,
  FriendshipSchema,
  PresenceSchema,
  ProfileBioSchema,
  PublicUserSchema,
  TimestampSchema,
  VoiceCodecSchema,
} from "./common.js";

const envelope = <T extends string, S extends z.ZodType>(type: T, payload: S) =>
  z.object({ type: z.literal(type), payload });

export const ClientEventSchema = z.discriminatedUnion("type", [
  envelope("auth.login", LoginRequestSchema),
  envelope("auth.register", RegisterRequestSchema),
  envelope("auth.resume", z.object({ accessToken: z.string().min(20) })),
  envelope(
    "message.send",
    z.object({
      clientId: IdSchema,
      scope: MessageScopeSchema,
      targetId: IdSchema,
      body: MessageBodySchema,
    }),
  ),
  envelope(
    "message.edit",
    z.object({ messageId: IdSchema, body: MessageBodySchema }),
  ),
  envelope("message.delete", z.object({ messageId: IdSchema })),
  envelope(
    "presence.update",
    z.object({
      presence: PresenceSchema.exclude(["offline"]),
      activity: z.string().max(120),
    }),
  ),
  envelope(
    "profile.update",
    z.object({
      displayName: DisplayNameSchema,
      bio: ProfileBioSchema,
      avatar: AvatarSchema,
      activity: z.string().trim().max(120),
    }),
  ),
  envelope("friend.request", z.object({ userId: IdSchema })),
  envelope(
    "friend.respond",
    z.object({
      friendshipId: IdSchema,
      action: z.enum(["accept", "decline"]),
    }),
  ),
  envelope("friend.remove", z.object({ userId: IdSchema })),
  envelope("friend.block", z.object({ userId: IdSchema })),
  envelope("conversation.open", z.object({ userId: IdSchema })),
  envelope("conversation.close", z.object({ userId: IdSchema })),
  envelope("account.delete", DeleteAccountRequestSchema),
  envelope(
    "typing.update",
    z.object({
      scope: MessageScopeSchema,
      targetId: IdSchema,
      typing: z.boolean(),
    }),
  ),
  envelope(
    "voice.join",
    z.object({
      roomId: z.string().min(1).max(96),
      codec: VoiceCodecSchema.optional(),
    }),
  ),
  envelope("voice.leave", z.object({ roomId: z.string().min(1).max(96) })),
  envelope(
    "voice.audio",
    z.object({
      roomId: z.string().min(1).max(96),
      sampleRate: z.number().int().min(8_000).max(192_000),
      codec: VoiceCodecSchema.optional(),
      samples: z.string().min(1).max(350_000),
    }),
  ),
  envelope("ping", z.object({ sentAt: TimestampSchema })),
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;

export const ServerEventSchema = z.discriminatedUnion("type", [
  envelope("session.ready", SessionReadySchema),
  envelope("error", ApiErrorSchema),
  envelope("message.created", ChatMessageSchema),
  envelope("message.updated", ChatMessageSchema),
  envelope(
    "message.deleted",
    z.object({
      messageId: IdSchema,
      authorId: IdSchema,
      scope: MessageScopeSchema,
      targetId: IdSchema,
    }),
  ),
  envelope("channel.created", ChannelSchema),
  envelope("presence.changed", PublicUserSchema),
  envelope("profile.updated", PublicUserSchema),
  envelope("profile.removed", z.object({ userId: IdSchema })),
  envelope("account.deleted", DeleteAccountResponseSchema),
  envelope("friendship.changed", FriendshipSchema),
  envelope(
    "friendship.removed",
    z.object({ userId: IdSchema, otherUserId: IdSchema }),
  ),
  envelope("conversation.opened", ConversationSchema),
  envelope(
    "conversation.closed",
    z.object({ userId: IdSchema, contactId: IdSchema }),
  ),
  envelope(
    "typing.changed",
    z.object({
      userId: IdSchema,
      scope: MessageScopeSchema,
      targetId: IdSchema,
      typing: z.boolean(),
    }),
  ),
  envelope(
    "voice.state",
    z.object({ roomId: z.string(), participantIds: z.array(IdSchema) }),
  ),
  envelope(
    "voice.audio",
    z.object({
      roomId: z.string(),
      userId: IdSchema,
      sampleRate: z.number().int(),
      codec: VoiceCodecSchema.optional(),
      samples: z.string(),
    }),
  ),
  envelope("pong", z.object({ sentAt: TimestampSchema })),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
