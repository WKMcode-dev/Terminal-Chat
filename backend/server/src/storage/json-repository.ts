import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import type { Presence } from "@terminal-chat/protocol";

import type {
  CreateChannelInput,
  CreateMessageInput,
  CreateUserInput,
  Repository,
  StoredChannel,
  StoredFriendship,
  StoredMessage,
  StoredUser,
  UpdateProfileInput,
} from "./types.js";

interface JsonState {
  users: StoredUser[];
  channels: StoredChannel[];
  channelMembers: Array<{
    channelId: string;
    userId: string;
    role: "owner" | "member";
  }>;
  messages: StoredMessage[];
  friendships: StoredFriendship[];
  hiddenConversations: Array<{ userId: string; contactId: string }>;
}

const EMPTY_STATE: JsonState = {
  users: [],
  channels: [],
  channelMembers: [],
  messages: [],
  friendships: [],
  hiddenConversations: [],
};

export class JsonRepository implements Repository {
  readonly kind = "json" as const;
  private state: JsonState = structuredClone(EMPTY_STATE);
  private writeQueue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = parseState(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.persist();
    }
    await this.ensureGeneralChannel();
  }

  async close(): Promise<void> {
    await this.writeQueue;
  }

  async healthCheck(): Promise<void> {
    await this.writeQueue;
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    if (this.state.users.some((user) => user.username === input.username)) {
      throw new Error("USERNAME_TAKEN");
    }
    const user: StoredUser = {
      id: randomUUID(),
      username: input.username,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      presence: "offline",
      activity: "",
      bio: "",
      avatar: "",
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(user);
    for (const channel of this.state.channels) {
      this.state.channelMembers.push({
        channelId: channel.id,
        userId: user.id,
        role: "member",
      });
    }
    await this.persist();
    return structuredClone(user);
  }

  async findUserByUsername(username: string): Promise<StoredUser | undefined> {
    return clone(this.state.users.find((user) => user.username === username));
  }

  async findUserById(id: string): Promise<StoredUser | undefined> {
    return clone(this.state.users.find((user) => user.id === id));
  }

  async listUsers(): Promise<StoredUser[]> {
    return structuredClone(this.state.users);
  }

  async deleteUser(userId: string): Promise<boolean> {
    const previousLength = this.state.users.length;
    this.state.users = this.state.users.filter((user) => user.id !== userId);
    if (this.state.users.length === previousLength) return false;

    this.state.channelMembers = this.state.channelMembers.filter(
      (member) => member.userId !== userId,
    );
    this.state.messages = this.state.messages.filter(
      (message) =>
        message.authorId !== userId && message.recipientId !== userId,
    );
    this.state.friendships = this.state.friendships.filter(
      (friendship) =>
        friendship.requesterId !== userId && friendship.addresseeId !== userId,
    );
    this.state.hiddenConversations = this.state.hiddenConversations.filter(
      (conversation) =>
        conversation.userId !== userId && conversation.contactId !== userId,
    );
    await this.persist();
    return true;
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<StoredUser> {
    const user = this.state.users.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    user.displayName = input.displayName;
    user.bio = input.bio;
    user.avatar = input.avatar;
    user.activity = input.activity;
    await this.persist();
    return structuredClone(user);
  }

  async updatePresence(
    userId: string,
    presence: Presence,
    activity: string,
  ): Promise<StoredUser> {
    const user = this.state.users.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    user.presence = presence;
    user.activity = activity;
    await this.persist();
    return structuredClone(user);
  }

  async listChannelsForUser(userId: string): Promise<StoredChannel[]> {
    const ids = new Set(
      this.state.channelMembers
        .filter((member) => member.userId === userId)
        .map((member) => member.channelId),
    );
    return structuredClone(
      this.state.channels.filter((channel) => ids.has(channel.id)),
    );
  }

  async createChannel(input: CreateChannelInput): Promise<StoredChannel> {
    if (this.state.channels.some((channel) => channel.name === input.name)) {
      throw new Error("CHANNEL_TAKEN");
    }
    const channel: StoredChannel = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      createdAt: new Date().toISOString(),
    };
    this.state.channels.push(channel);
    for (const user of this.state.users) {
      this.state.channelMembers.push({
        channelId: channel.id,
        userId: user.id,
        role: user.id === input.ownerId ? "owner" : "member",
      });
    }
    await this.persist();
    return structuredClone(channel);
  }

  async isChannelMember(userId: string, channelId: string): Promise<boolean> {
    return this.state.channelMembers.some(
      (member) => member.userId === userId && member.channelId === channelId,
    );
  }

  async listChannelMessages(
    channelId: string,
    limit: number,
  ): Promise<StoredMessage[]> {
    return tail(
      this.state.messages.filter(
        (message) =>
          message.scope === "channel" && message.targetId === channelId,
      ),
      limit,
    );
  }

  async listDirectMessages(
    userId: string,
    contactId: string,
    limit: number,
  ): Promise<StoredMessage[]> {
    return tail(
      this.state.messages.filter(
        (message) =>
          message.scope === "direct" &&
          ((message.authorId === userId && message.recipientId === contactId) ||
            (message.authorId === contactId && message.recipientId === userId)),
      ),
      limit,
    );
  }

  async createMessage(input: CreateMessageInput): Promise<StoredMessage> {
    const duplicate = this.state.messages.find(
      (message) =>
        message.authorId === input.authorId &&
        message.clientId === input.clientId,
    );
    if (duplicate) return structuredClone(duplicate);

    const message: StoredMessage = {
      id: randomUUID(),
      clientId: input.clientId,
      scope: input.scope,
      targetId: input.targetId,
      authorId: input.authorId,
      body: input.body,
      createdAt: new Date().toISOString(),
    };
    if (input.scope === "direct") message.recipientId = input.targetId;
    this.state.messages.push(message);
    await this.persist();
    return structuredClone(message);
  }

  async findMessageById(messageId: string): Promise<StoredMessage | undefined> {
    return clone(
      this.state.messages.find((message) => message.id === messageId),
    );
  }

  async updateMessage(
    messageId: string,
    body: string,
  ): Promise<StoredMessage | undefined> {
    const message = this.state.messages.find(
      (candidate) => candidate.id === messageId,
    );
    if (!message) return undefined;
    message.body = body;
    message.editedAt = new Date().toISOString();
    await this.persist();
    return structuredClone(message);
  }

  async deleteMessage(messageId: string): Promise<StoredMessage | undefined> {
    const index = this.state.messages.findIndex(
      (message) => message.id === messageId,
    );
    if (index < 0) return undefined;
    const [message] = this.state.messages.splice(index, 1);
    await this.persist();
    return message ? structuredClone(message) : undefined;
  }

  async listFriendshipsForUser(userId: string): Promise<StoredFriendship[]> {
    return structuredClone(
      this.state.friendships.filter(
        (friendship) =>
          friendship.requesterId === userId ||
          friendship.addresseeId === userId,
      ),
    );
  }

  async hasAcceptedFriendship(
    userId: string,
    otherUserId: string,
  ): Promise<boolean> {
    return this.state.friendships.some(
      (friendship) =>
        friendship.status === "accepted" &&
        includesUsers(friendship, userId, otherUserId),
    );
  }

  async createFriendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<StoredFriendship> {
    validateFriendshipUsers(this.state, requesterId, addresseeId);
    const existing = findFriendship(
      this.state.friendships,
      requesterId,
      addresseeId,
    );
    if (existing?.status === "blocked") throw new Error("USER_BLOCKED");
    if (existing?.status === "accepted") throw new Error("FRIENDSHIP_EXISTS");
    if (existing) throw new Error("FRIEND_REQUEST_EXISTS");
    const now = new Date().toISOString();
    const friendship: StoredFriendship = {
      id: randomUUID(),
      requesterId,
      addresseeId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.state.friendships.push(friendship);
    await this.persist();
    return structuredClone(friendship);
  }

  async respondFriendRequest(
    userId: string,
    friendshipId: string,
    action: "accept" | "decline",
  ): Promise<StoredFriendship | undefined> {
    const index = this.state.friendships.findIndex(
      (friendship) => friendship.id === friendshipId,
    );
    const friendship = this.state.friendships[index];
    if (
      !friendship ||
      friendship.status !== "pending" ||
      friendship.addresseeId !== userId
    ) {
      throw new Error("FRIEND_REQUEST_NOT_FOUND");
    }
    if (action === "decline") {
      this.state.friendships.splice(index, 1);
      await this.persist();
      return undefined;
    }
    friendship.status = "accepted";
    friendship.updatedAt = new Date().toISOString();
    await this.persist();
    return structuredClone(friendship);
  }

  async removeFriendship(
    userId: string,
    otherUserId: string,
  ): Promise<boolean> {
    const index = this.state.friendships.findIndex(
      (friendship) =>
        includesUsers(friendship, userId, otherUserId) &&
        (friendship.status !== "blocked" || friendship.requesterId === userId),
    );
    if (index < 0) return false;
    this.state.friendships.splice(index, 1);
    await this.persist();
    return true;
  }

  async blockUser(
    userId: string,
    otherUserId: string,
  ): Promise<StoredFriendship> {
    validateFriendshipUsers(this.state, userId, otherUserId);
    this.state.friendships = this.state.friendships.filter(
      (friendship) => !includesUsers(friendship, userId, otherUserId),
    );
    const now = new Date().toISOString();
    const friendship: StoredFriendship = {
      id: randomUUID(),
      requesterId: userId,
      addresseeId: otherUserId,
      status: "blocked",
      createdAt: now,
      updatedAt: now,
    };
    this.state.friendships.push(friendship);
    await this.persist();
    return structuredClone(friendship);
  }

  async listHiddenConversationIds(userId: string): Promise<string[]> {
    return this.state.hiddenConversations
      .filter((conversation) => conversation.userId === userId)
      .map((conversation) => conversation.contactId);
  }

  async showConversation(userId: string, otherUserId: string): Promise<void> {
    const previousLength = this.state.hiddenConversations.length;
    this.state.hiddenConversations = this.state.hiddenConversations.filter(
      (conversation) =>
        !(
          conversation.userId === userId &&
          conversation.contactId === otherUserId
        ),
    );
    if (this.state.hiddenConversations.length !== previousLength)
      await this.persist();
  }

  async hideConversation(userId: string, otherUserId: string): Promise<void> {
    if (
      !this.state.hiddenConversations.some(
        (conversation) =>
          conversation.userId === userId &&
          conversation.contactId === otherUserId,
      )
    ) {
      this.state.hiddenConversations.push({ userId, contactId: otherUserId });
      await this.persist();
    }
  }

  private async ensureGeneralChannel(): Promise<void> {
    let changed = false;
    if (this.state.channels.length === 0) {
      this.state.channels.push({
        id: randomUUID(),
        name: "geral",
        description: "Canal principal da comunidade",
        createdAt: new Date().toISOString(),
      });
      changed = true;
    }
    for (const channel of this.state.channels) {
      for (const user of this.state.users) {
        const alreadyMember = this.state.channelMembers.some(
          (member) =>
            member.channelId === channel.id && member.userId === user.id,
        );
        if (!alreadyMember) {
          this.state.channelMembers.push({
            channelId: channel.id,
            userId: user.id,
            role: "member",
          });
          changed = true;
        }
      }
    }
    if (changed) await this.persist();
  }

  private async persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporary, this.filePath);
    });
    await this.writeQueue;
  }
}

function parseState(raw: string): JsonState {
  const parsed = JSON.parse(raw) as Partial<JsonState>;
  if (
    !Array.isArray(parsed.users) ||
    !Array.isArray(parsed.channels) ||
    !Array.isArray(parsed.messages)
  ) {
    throw new Error("Arquivo de dados inválido");
  }
  return {
    users: parsed.users.map((user) => ({
      ...user,
      bio: typeof user.bio === "string" ? user.bio : "",
      avatar: typeof user.avatar === "string" ? user.avatar : "",
    })),
    channels: parsed.channels,
    channelMembers: Array.isArray(parsed.channelMembers)
      ? parsed.channelMembers
      : [],
    messages: parsed.messages,
    friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
    hiddenConversations: Array.isArray(parsed.hiddenConversations)
      ? parsed.hiddenConversations
      : [],
  };
}

function validateFriendshipUsers(
  state: JsonState,
  userId: string,
  otherUserId: string,
): void {
  if (userId === otherUserId) throw new Error("FRIEND_SELF");
  if (!state.users.some((user) => user.id === otherUserId))
    throw new Error("USER_NOT_FOUND");
}

function findFriendship(
  friendships: StoredFriendship[],
  userId: string,
  otherUserId: string,
): StoredFriendship | undefined {
  return friendships.find((friendship) =>
    includesUsers(friendship, userId, otherUserId),
  );
}

function includesUsers(
  friendship: StoredFriendship,
  userId: string,
  otherUserId: string,
): boolean {
  return (
    (friendship.requesterId === userId &&
      friendship.addresseeId === otherUserId) ||
    (friendship.requesterId === otherUserId &&
      friendship.addresseeId === userId)
  );
}

function clone<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}

function tail(messages: StoredMessage[], limit: number): StoredMessage[] {
  return structuredClone(messages.slice(-Math.max(1, Math.min(limit, 200))));
}
