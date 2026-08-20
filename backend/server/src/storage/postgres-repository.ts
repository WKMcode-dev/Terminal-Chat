import { randomUUID } from "node:crypto";

import type { Presence } from "@terminal-chat/protocol";
import postgres from "postgres";

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

type Row = Record<string, unknown>;

export class PostgresRepository implements Repository {
  readonly kind = "postgres" as const;
  private readonly sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  async init(): Promise<void> {
    await this.sql.unsafe(`
      create table if not exists users (
        id uuid primary key,
        username varchar(24) not null unique,
        display_name varchar(40) not null,
        password_hash text not null,
        presence varchar(16) not null default 'offline',
        activity varchar(120) not null default '',
        bio varchar(240) not null default '',
        avatar varchar(16) not null default '',
        created_at timestamptz not null default now()
      );
      alter table users add column if not exists bio varchar(240) not null default '';
      alter table users add column if not exists avatar varchar(16) not null default '';
      create table if not exists channels (
        id uuid primary key,
        name varchar(32) not null unique,
        description varchar(160) not null default '',
        created_at timestamptz not null default now()
      );
      create table if not exists channel_members (
        channel_id uuid not null references channels(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        role varchar(16) not null default 'member',
        primary key (channel_id, user_id)
      );
      create table if not exists messages (
        id uuid primary key,
        client_id uuid not null,
        scope varchar(16) not null,
        target_id uuid not null,
        author_id uuid not null references users(id) on delete cascade,
        recipient_id uuid references users(id) on delete cascade,
        body varchar(4000) not null,
        created_at timestamptz not null default now(),
        edited_at timestamptz,
        unique (author_id, client_id)
      );
      alter table messages add column if not exists edited_at timestamptz;
      create table if not exists friendships (
        id uuid primary key,
        requester_id uuid not null references users(id) on delete cascade,
        addressee_id uuid not null references users(id) on delete cascade,
        status varchar(16) not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (requester_id <> addressee_id)
      );
      create unique index if not exists friendships_pair_idx
        on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
      create table if not exists hidden_conversations (
        user_id uuid not null references users(id) on delete cascade,
        contact_id uuid not null references users(id) on delete cascade,
        hidden_at timestamptz not null default now(),
        primary key (user_id, contact_id),
        check (user_id <> contact_id)
      );
      create index if not exists messages_channel_idx on messages(target_id, created_at);
      create index if not exists messages_direct_idx on messages(author_id, recipient_id, created_at);
    `);

    const channels = await this.sql`select id from channels limit 1`;
    if (channels.length === 0) {
      await this.sql`
        insert into channels (id, name, description)
        values (${randomUUID()}, 'geral', 'Canal principal da comunidade')
        on conflict (name) do nothing
      `;
    }
    await this.sql`
      insert into channel_members (channel_id, user_id, role)
      select channels.id, users.id, 'member'
      from channels cross join users
      on conflict do nothing
    `;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }

  async healthCheck(): Promise<void> {
    await this.sql`select 1`;
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    try {
      const rows = await this.sql`
        insert into users (id, username, display_name, password_hash)
        values (${randomUUID()}, ${input.username}, ${input.displayName}, ${input.passwordHash})
        returning *
      `;
      const user = mapUser(rows[0] as Row);
      await this.sql`
        insert into channel_members (channel_id, user_id, role)
        select id, ${user.id}, 'member' from channels
        on conflict do nothing
      `;
      return user;
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("USERNAME_TAKEN");
      throw error;
    }
  }

  async findUserByUsername(username: string): Promise<StoredUser | undefined> {
    const rows = await this
      .sql`select * from users where username = ${username} limit 1`;
    return rows[0] ? mapUser(rows[0] as Row) : undefined;
  }

  async findUserById(id: string): Promise<StoredUser | undefined> {
    const rows = await this.sql`select * from users where id = ${id} limit 1`;
    return rows[0] ? mapUser(rows[0] as Row) : undefined;
  }

  async listUsers(): Promise<StoredUser[]> {
    const rows = await this.sql`select * from users order by display_name`;
    return rows.map((row) => mapUser(row as Row));
  }

  async deleteUser(userId: string): Promise<boolean> {
    const rows = await this.sql`
      delete from users where id = ${userId} returning id
    `;
    return rows.length > 0;
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<StoredUser> {
    const rows = await this.sql`
      update users set
        display_name = ${input.displayName},
        bio = ${input.bio},
        avatar = ${input.avatar},
        activity = ${input.activity}
      where id = ${userId}
      returning *
    `;
    if (!rows[0]) throw new Error("USER_NOT_FOUND");
    return mapUser(rows[0] as Row);
  }

  async updatePresence(
    userId: string,
    presence: Presence,
    activity: string,
  ): Promise<StoredUser> {
    const rows = await this.sql`
      update users set presence = ${presence}, activity = ${activity} where id = ${userId} returning *
    `;
    if (!rows[0]) throw new Error("USER_NOT_FOUND");
    return mapUser(rows[0] as Row);
  }

  async listChannelsForUser(userId: string): Promise<StoredChannel[]> {
    const rows = await this.sql`
      select c.* from channels c
      join channel_members cm on cm.channel_id = c.id
      where cm.user_id = ${userId}
      order by c.name
    `;
    return rows.map((row) => mapChannel(row as Row));
  }

  async createChannel(input: CreateChannelInput): Promise<StoredChannel> {
    try {
      const rows = await this.sql`
        insert into channels (id, name, description)
        values (${randomUUID()}, ${input.name}, ${input.description}) returning *
      `;
      const channel = mapChannel(rows[0] as Row);
      await this.sql`
        insert into channel_members (channel_id, user_id, role)
        select ${channel.id}, id, case when id = ${input.ownerId} then 'owner' else 'member' end from users
        on conflict do nothing
      `;
      return channel;
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("CHANNEL_TAKEN");
      throw error;
    }
  }

  async isChannelMember(userId: string, channelId: string): Promise<boolean> {
    const rows = await this.sql`
      select 1 from channel_members where user_id = ${userId} and channel_id = ${channelId} limit 1
    `;
    return rows.length > 0;
  }

  async listChannelMessages(
    channelId: string,
    limit: number,
  ): Promise<StoredMessage[]> {
    const rows = await this.sql`
      select * from (
        select * from messages where scope = 'channel' and target_id = ${channelId}
        order by created_at desc limit ${safeLimit(limit)}
      ) recent order by created_at asc
    `;
    return rows.map((row) => mapMessage(row as Row));
  }

  async listDirectMessages(
    userId: string,
    contactId: string,
    limit: number,
  ): Promise<StoredMessage[]> {
    const rows = await this.sql`
      select * from (
        select * from messages
        where scope = 'direct' and (
          (author_id = ${userId} and recipient_id = ${contactId}) or
          (author_id = ${contactId} and recipient_id = ${userId})
        ) order by created_at desc limit ${safeLimit(limit)}
      ) recent order by created_at asc
    `;
    return rows.map((row) => mapMessage(row as Row));
  }

  async createMessage(input: CreateMessageInput): Promise<StoredMessage> {
    const recipientId = input.scope === "direct" ? input.targetId : null;
    const rows = await this.sql`
      insert into messages (id, client_id, scope, target_id, author_id, recipient_id, body)
      values (
        ${randomUUID()}, ${input.clientId}, ${input.scope}, ${input.targetId},
        ${input.authorId}, ${recipientId}, ${input.body}
      )
      on conflict (author_id, client_id) do update set body = messages.body
      returning *
    `;
    return mapMessage(rows[0] as Row);
  }

  async findMessageById(messageId: string): Promise<StoredMessage | undefined> {
    const rows = await this
      .sql`select * from messages where id = ${messageId} limit 1`;
    return rows[0] ? mapMessage(rows[0] as Row) : undefined;
  }

  async updateMessage(
    messageId: string,
    body: string,
  ): Promise<StoredMessage | undefined> {
    const rows = await this.sql`
      update messages set body = ${body}, edited_at = now()
      where id = ${messageId}
      returning *
    `;
    return rows[0] ? mapMessage(rows[0] as Row) : undefined;
  }

  async deleteMessage(messageId: string): Promise<StoredMessage | undefined> {
    const rows = await this.sql`
      delete from messages where id = ${messageId} returning *
    `;
    return rows[0] ? mapMessage(rows[0] as Row) : undefined;
  }

  async listFriendshipsForUser(userId: string): Promise<StoredFriendship[]> {
    const rows = await this.sql`
      select * from friendships
      where requester_id = ${userId} or addressee_id = ${userId}
      order by updated_at desc
    `;
    return rows.map((row) => mapFriendship(row as Row));
  }

  async hasAcceptedFriendship(
    userId: string,
    otherUserId: string,
  ): Promise<boolean> {
    const rows = await this.sql`
      select 1 from friendships
      where status = 'accepted' and (
        (requester_id = ${userId} and addressee_id = ${otherUserId}) or
        (requester_id = ${otherUserId} and addressee_id = ${userId})
      ) limit 1
    `;
    return rows.length > 0;
  }

  async createFriendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<StoredFriendship> {
    if (requesterId === addresseeId) throw new Error("FRIEND_SELF");
    if (!(await this.findUserById(addresseeId)))
      throw new Error("USER_NOT_FOUND");
    const existing = await this.sql`
      select * from friendships
      where (requester_id = ${requesterId} and addressee_id = ${addresseeId})
         or (requester_id = ${addresseeId} and addressee_id = ${requesterId})
      limit 1
    `;
    if (existing[0]) {
      const friendship = mapFriendship(existing[0] as Row);
      if (friendship.status === "blocked") throw new Error("USER_BLOCKED");
      if (friendship.status === "accepted")
        throw new Error("FRIENDSHIP_EXISTS");
      throw new Error("FRIEND_REQUEST_EXISTS");
    }
    const rows = await this.sql`
      insert into friendships (id, requester_id, addressee_id, status)
      values (${randomUUID()}, ${requesterId}, ${addresseeId}, 'pending')
      returning *
    `;
    return mapFriendship(rows[0] as Row);
  }

  async respondFriendRequest(
    userId: string,
    friendshipId: string,
    action: "accept" | "decline",
  ): Promise<StoredFriendship | undefined> {
    const existing = await this.sql`
      select * from friendships
      where id = ${friendshipId} and addressee_id = ${userId} and status = 'pending'
      limit 1
    `;
    if (!existing[0]) throw new Error("FRIEND_REQUEST_NOT_FOUND");
    if (action === "decline") {
      await this.sql`delete from friendships where id = ${friendshipId}`;
      return undefined;
    }
    const rows = await this.sql`
      update friendships set status = 'accepted', updated_at = now()
      where id = ${friendshipId}
      returning *
    `;
    return mapFriendship(rows[0] as Row);
  }

  async removeFriendship(
    userId: string,
    otherUserId: string,
  ): Promise<boolean> {
    const rows = await this.sql`
      delete from friendships
      where (
        (requester_id = ${userId} and addressee_id = ${otherUserId}) or
        (requester_id = ${otherUserId} and addressee_id = ${userId} and status <> 'blocked')
      )
      returning id
    `;
    return rows.length > 0;
  }

  async blockUser(
    userId: string,
    otherUserId: string,
  ): Promise<StoredFriendship> {
    if (userId === otherUserId) throw new Error("FRIEND_SELF");
    if (!(await this.findUserById(otherUserId)))
      throw new Error("USER_NOT_FOUND");
    await this.sql`
      delete from friendships
      where (requester_id = ${userId} and addressee_id = ${otherUserId})
         or (requester_id = ${otherUserId} and addressee_id = ${userId})
    `;
    const rows = await this.sql`
      insert into friendships (id, requester_id, addressee_id, status)
      values (${randomUUID()}, ${userId}, ${otherUserId}, 'blocked')
      returning *
    `;
    return mapFriendship(rows[0] as Row);
  }

  async listHiddenConversationIds(userId: string): Promise<string[]> {
    const rows = await this.sql`
      select contact_id from hidden_conversations where user_id = ${userId}
    `;
    return rows.map((row) => String(row.contact_id));
  }

  async showConversation(userId: string, otherUserId: string): Promise<void> {
    await this.sql`
      delete from hidden_conversations
      where user_id = ${userId} and contact_id = ${otherUserId}
    `;
  }

  async hideConversation(userId: string, otherUserId: string): Promise<void> {
    await this.sql`
      insert into hidden_conversations (user_id, contact_id)
      values (${userId}, ${otherUserId})
      on conflict (user_id, contact_id)
      do update set hidden_at = now()
    `;
  }
}

function mapUser(row: Row): StoredUser {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    passwordHash: String(row.password_hash),
    presence: String(row.presence) as Presence,
    activity: String(row.activity),
    bio: String(row.bio ?? ""),
    avatar: String(row.avatar ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapFriendship(row: Row): StoredFriendship {
  return {
    id: String(row.id),
    requesterId: String(row.requester_id),
    addresseeId: String(row.addressee_id),
    status: String(row.status) as StoredFriendship["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapChannel(row: Row): StoredChannel {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapMessage(row: Row): StoredMessage {
  const message: StoredMessage = {
    id: String(row.id),
    clientId: String(row.client_id),
    scope: String(row.scope) as "channel" | "direct",
    targetId: String(row.target_id),
    authorId: String(row.author_id),
    body: String(row.body),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
  if (row.recipient_id) message.recipientId = String(row.recipient_id);
  if (row.edited_at)
    message.editedAt = new Date(String(row.edited_at)).toISOString();
  return message;
}

function safeLimit(limit: number): number {
  return Math.max(1, Math.min(Math.trunc(limit), 200));
}
