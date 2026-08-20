import type {
  Channel,
  ChatMessage,
  MessageScope,
  Presence,
  PublicUser,
  Friendship,
} from "@terminal-chat/protocol";

export interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface StoredChannel extends Omit<
  Channel,
  "membersOnline" | "unread"
> {}

export interface StoredMessage {
  id: string;
  clientId?: string;
  scope: MessageScope;
  targetId: string;
  authorId: string;
  recipientId?: string;
  body: string;
  createdAt: string;
  editedAt?: string;
}

export type StoredFriendship = Friendship;

export interface CreateUserInput {
  username: string;
  displayName: string;
  passwordHash: string;
}

export interface CreateMessageInput {
  clientId: string;
  scope: MessageScope;
  targetId: string;
  authorId: string;
  body: string;
}

export interface UpdateProfileInput {
  displayName: string;
  bio: string;
  avatar: string;
  activity: string;
}

export interface CreateChannelInput {
  name: string;
  description: string;
  ownerId: string;
}

export interface Repository {
  readonly kind: "json" | "postgres";
  init(): Promise<void>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
  createUser(input: CreateUserInput): Promise<StoredUser>;
  findUserByUsername(username: string): Promise<StoredUser | undefined>;
  findUserById(id: string): Promise<StoredUser | undefined>;
  listUsers(): Promise<StoredUser[]>;
  deleteUser(userId: string): Promise<boolean>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<StoredUser>;
  updatePresence(
    userId: string,
    presence: Presence,
    activity: string,
  ): Promise<StoredUser>;
  listChannelsForUser(userId: string): Promise<StoredChannel[]>;
  createChannel(input: CreateChannelInput): Promise<StoredChannel>;
  isChannelMember(userId: string, channelId: string): Promise<boolean>;
  listChannelMessages(
    channelId: string,
    limit: number,
  ): Promise<StoredMessage[]>;
  listDirectMessages(
    userId: string,
    contactId: string,
    limit: number,
  ): Promise<StoredMessage[]>;
  createMessage(input: CreateMessageInput): Promise<StoredMessage>;
  findMessageById(messageId: string): Promise<StoredMessage | undefined>;
  updateMessage(
    messageId: string,
    body: string,
  ): Promise<StoredMessage | undefined>;
  deleteMessage(messageId: string): Promise<StoredMessage | undefined>;
  listFriendshipsForUser(userId: string): Promise<StoredFriendship[]>;
  hasAcceptedFriendship(userId: string, otherUserId: string): Promise<boolean>;
  createFriendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<StoredFriendship>;
  respondFriendRequest(
    userId: string,
    friendshipId: string,
    action: "accept" | "decline",
  ): Promise<StoredFriendship | undefined>;
  removeFriendship(userId: string, otherUserId: string): Promise<boolean>;
  blockUser(userId: string, otherUserId: string): Promise<StoredFriendship>;
  listHiddenConversationIds(userId: string): Promise<string[]>;
  showConversation(userId: string, otherUserId: string): Promise<void>;
  hideConversation(userId: string, otherUserId: string): Promise<void>;
}

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export function toChatMessage(
  message: StoredMessage,
  author: StoredUser,
): ChatMessage {
  const result: ChatMessage = {
    id: message.id,
    scope: message.scope,
    targetId: message.targetId,
    author: toPublicUser(author),
    body: message.body,
    createdAt: message.createdAt,
  };
  if (message.clientId) result.clientId = message.clientId;
  if (message.editedAt) result.editedAt = message.editedAt;
  return result;
}
