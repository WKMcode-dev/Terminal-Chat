import type {
  Bootstrap,
  ChatMessage,
  PublicUser,
} from "@terminal-chat/protocol";

import type { Repository, StoredUser } from "../storage/index.js";
import { toChatMessage, toPublicUser } from "../storage/index.js";

export async function buildBootstrap(
  repository: Repository,
  userId: string,
  onlineUserIds: ReadonlySet<string>,
): Promise<Bootstrap> {
  const [self, users, storedChannels, friendships] = await Promise.all([
    repository.findUserById(userId),
    repository.listUsers(),
    repository.listChannelsForUser(userId),
    repository.listFriendshipsForUser(userId),
  ]);
  if (!self) throw new Error("USER_NOT_FOUND");

  const usersById = new Map(users.map((user) => [user.id, user]));
  const publicUsers = users.map((user) =>
    withConnectionPresence(user, onlineUserIds),
  );
  const publicById = new Map(publicUsers.map((user) => [user.id, user]));

  const channelEntries = await Promise.all(
    storedChannels.map(async (channel) => {
      const storedMessages = await repository.listChannelMessages(
        channel.id,
        100,
      );
      return [channel.id, mapMessages(storedMessages, usersById)] as const;
    }),
  );
  const channelMessages = Object.fromEntries(channelEntries);

  const contacts = users.filter((user) => user.id !== userId);
  const conversations = await Promise.all(
    contacts.map(async (contact) => ({
      contact: publicById.get(contact.id)!,
      unread: 0,
      messages: mapMessages(
        await repository.listDirectMessages(userId, contact.id, 100),
        usersById,
      ),
    })),
  );

  return {
    self: publicById.get(self.id)!,
    profiles: publicUsers,
    channels: storedChannels.map((channel) => ({
      ...channel,
      unread: 0,
      membersOnline: publicUsers.filter((user) => user.presence !== "offline")
        .length,
    })),
    conversations,
    channelMessages,
    friendships,
  };
}

function mapMessages(
  messages: Awaited<ReturnType<Repository["listChannelMessages"]>>,
  usersById: ReadonlyMap<string, StoredUser>,
): ChatMessage[] {
  return messages.flatMap((message) => {
    const author = usersById.get(message.authorId);
    return author ? [toChatMessage(message, author)] : [];
  });
}

function withConnectionPresence(
  user: StoredUser,
  onlineIds: ReadonlySet<string>,
): PublicUser {
  const publicUser = toPublicUser(user);
  return onlineIds.has(user.id)
    ? publicUser
    : { ...publicUser, presence: "offline", activity: "" };
}
