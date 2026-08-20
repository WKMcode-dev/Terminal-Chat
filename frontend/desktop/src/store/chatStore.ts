import { create } from "zustand";

import type {
  Bootstrap,
  Channel,
  ChatMessage,
  Conversation,
  Friendship,
  PublicUser,
  ServerEvent,
} from "@terminal-chat/protocol";

export type AppView = "conversations" | "channels" | "profiles" | "settings";

interface ChatState {
  currentUser?: PublicUser;
  channels: Channel[];
  profiles: PublicUser[];
  conversations: Conversation[];
  friendships: Friendship[];
  channelMessages: Record<string, ChatMessage[]>;
  view: AppView;
  activeChannelId?: string;
  activeContactId?: string;
  connected: boolean;
  notice?: string;
  pendingMessageIds: string[];
  hydrate: (bootstrap: Bootstrap) => void;
  applyEvent: (event: ServerEvent) => void;
  setView: (view: AppView) => void;
  selectChannel: (id: string) => void;
  selectContact: (id: string) => void;
  addChannel: (channel: Channel) => void;
  queueMessage: (input: {
    clientId: string;
    scope: "channel" | "direct";
    targetId: string;
    body: string;
  }) => void;
  failMessage: (clientId: string) => void;
  closeConversation: (contactId: string) => void;
  openConversation: (contactId: string) => void;
  clear: () => void;
}

const EMPTY = {
  channels: [],
  profiles: [],
  conversations: [],
  friendships: [],
  channelMessages: {},
} satisfies Pick<
  ChatState,
  "channels" | "profiles" | "conversations" | "friendships" | "channelMessages"
>;

export const useChatStore = create<ChatState>((set) => ({
  ...EMPTY,
  view: "channels",
  connected: false,
  pendingMessageIds: [],

  hydrate: (bootstrap) =>
    set((state) => ({
      currentUser: bootstrap.self,
      channels: bootstrap.channels,
      profiles: bootstrap.profiles,
      conversations: bootstrap.conversations,
      friendships: bootstrap.friendships,
      channelMessages: bootstrap.channelMessages,
      activeChannelId: bootstrap.channels.some(
        (channel) => channel.id === state.activeChannelId,
      )
        ? state.activeChannelId
        : bootstrap.channels[0]?.id,
      activeContactId: bootstrap.conversations.some(
        (conversation) => conversation.contact.id === state.activeContactId,
      )
        ? state.activeContactId
        : bootstrap.conversations[0]?.contact.id,
      connected: true,
      notice: undefined,
      pendingMessageIds: [],
    })),

  applyEvent: (event) =>
    set((state) => {
      switch (event.type) {
        case "session.ready":
          return {
            currentUser: event.payload.bootstrap.self,
            channels: event.payload.bootstrap.channels,
            profiles: event.payload.bootstrap.profiles,
            conversations: event.payload.bootstrap.conversations,
            friendships: event.payload.bootstrap.friendships,
            channelMessages: event.payload.bootstrap.channelMessages,
            activeChannelId: event.payload.bootstrap.channels.some(
              (channel) => channel.id === state.activeChannelId,
            )
              ? state.activeChannelId
              : event.payload.bootstrap.channels[0]?.id,
            activeContactId: event.payload.bootstrap.conversations.some(
              (conversation) =>
                conversation.contact.id === state.activeContactId,
            )
              ? state.activeContactId
              : event.payload.bootstrap.conversations[0]?.contact.id,
            connected: true,
            notice: undefined,
            pendingMessageIds: [],
          };
        case "message.created":
          return insertMessage(state, event.payload);
        case "message.updated":
          return updateMessage(state, event.payload);
        case "message.deleted":
          return deleteMessage(state, event.payload.messageId);
        case "channel.created":
          if (state.channels.some((channel) => channel.id === event.payload.id))
            return state;
          return {
            channels: [...state.channels, event.payload],
            channelMessages: {
              ...state.channelMessages,
              [event.payload.id]: [],
            },
          };
        case "presence.changed":
        case "profile.updated":
          return applyPresence(state, event.payload);
        case "profile.removed":
          return removeProfile(state, event.payload.userId);
        case "account.deleted":
          return state;
        case "friendship.changed":
          return applyFriendship(state, event.payload);
        case "conversation.opened":
          return upsertConversation(state, event.payload, false);
        case "conversation.closed":
          return closeConversationState(state, event.payload.contactId);
        case "friendship.removed": {
          const next = {
            friendships: state.friendships.some(
              (friendship) =>
                (friendship.requesterId === event.payload.userId &&
                  friendship.addresseeId === event.payload.otherUserId) ||
                (friendship.requesterId === event.payload.otherUserId &&
                  friendship.addresseeId === event.payload.userId),
            )
              ? state.friendships.filter(
                  (friendship) =>
                    !(
                      (friendship.requesterId === event.payload.userId &&
                        friendship.addresseeId === event.payload.otherUserId) ||
                      (friendship.requesterId === event.payload.otherUserId &&
                        friendship.addresseeId === event.payload.userId)
                    ),
                )
              : state.friendships,
          };
          const contactId =
            event.payload.userId === state.currentUser?.id
              ? event.payload.otherUserId
              : event.payload.userId;
          return { ...next, ...closeConversationState(state, contactId) };
        }
        case "error":
          return {
            connected: ![
              "RECONNECTING",
              "CONNECTION_LOST",
              "INVALID_SESSION",
            ].includes(event.payload.code)
              ? state.connected
              : false,
            notice: event.payload.message,
          };
        default:
          return state;
      }
    }),

  setView: (view) => set({ view }),
  selectChannel: (activeChannelId) =>
    set({ activeChannelId, view: "channels" }),
  selectContact: (activeContactId) =>
    set({ activeContactId, view: "conversations" }),
  addChannel: (channel) =>
    set((state) => ({
      channels: state.channels.some((candidate) => candidate.id === channel.id)
        ? state.channels
        : [...state.channels, channel],
      channelMessages: { ...state.channelMessages, [channel.id]: [] },
      activeChannelId: channel.id,
      view: "channels",
    })),
  queueMessage: (input) =>
    set((state) => {
      if (!state.currentUser) return state;
      const optimistic: ChatMessage = {
        id: input.clientId,
        clientId: input.clientId,
        scope: input.scope,
        targetId: input.targetId,
        author: state.currentUser,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      const inserted = insertMessage(state, optimistic);
      return {
        ...inserted,
        pendingMessageIds: [...state.pendingMessageIds, input.clientId],
      };
    }),
  failMessage: (clientId) =>
    set((state) =>
      state.pendingMessageIds.includes(clientId)
        ? {
            ...deleteMessage(state, clientId),
            pendingMessageIds: state.pendingMessageIds.filter(
              (id) => id !== clientId,
            ),
            notice: "A mensagem não pôde ser confirmada pelo servidor",
          }
        : state,
    ),
  closeConversation: (contactId) =>
    set((state) => closeConversationState(state, contactId)),
  openConversation: (contactId) =>
    set((state) => {
      const existing = state.conversations.find(
        (conversation) => conversation.contact.id === contactId,
      );
      const profile = state.profiles.find(
        (candidate) => candidate.id === contactId,
      );
      return {
        conversations:
          existing || !profile
            ? state.conversations
            : [
                ...state.conversations,
                { contact: profile, unread: 0, messages: [] },
              ],
        activeContactId: contactId,
        view: "conversations",
      };
    }),
  clear: () =>
    set({
      ...EMPTY,
      currentUser: undefined,
      view: "channels",
      activeChannelId: undefined,
      activeContactId: undefined,
      connected: false,
      notice: undefined,
      pendingMessageIds: [],
    }),
}));

function insertMessage(
  state: ChatState,
  message: ChatMessage,
): Partial<ChatState> {
  if (message.scope === "channel") {
    const messages = state.channelMessages[message.targetId] ?? [];
    const optimisticIndex = message.clientId
      ? messages.findIndex(
          (candidate) => candidate.clientId === message.clientId,
        )
      : -1;
    if (optimisticIndex >= 0) {
      const updated = [...messages];
      updated[optimisticIndex] = message;
      return {
        channelMessages: {
          ...state.channelMessages,
          [message.targetId]: updated,
        },
        pendingMessageIds: state.pendingMessageIds.filter(
          (id) => id !== message.clientId,
        ),
      };
    }
    if (messages.some((candidate) => candidate.id === message.id)) return state;
    return {
      channelMessages: {
        ...state.channelMessages,
        [message.targetId]: [...messages, message],
      },
    };
  }

  const contactId =
    message.author.id === state.currentUser?.id
      ? message.targetId
      : message.author.id;
  const existing = state.conversations.find(
    (conversation) => conversation.contact.id === contactId,
  );
  const contact = state.profiles.find((profile) => profile.id === contactId);
  if (!existing && contact) {
    return {
      conversations: [
        ...state.conversations,
        { contact, unread: 0, messages: [message] },
      ],
      pendingMessageIds: state.pendingMessageIds.filter(
        (id) => id !== message.clientId,
      ),
    };
  }
  return {
    conversations: state.conversations.map((conversation) => {
      if (conversation.contact.id !== contactId) return conversation;
      const optimisticIndex = message.clientId
        ? conversation.messages.findIndex(
            (candidate) => candidate.clientId === message.clientId,
          )
        : -1;
      if (optimisticIndex >= 0) {
        const messages = [...conversation.messages];
        messages[optimisticIndex] = message;
        return { ...conversation, messages };
      }
      if (
        conversation.messages.some((candidate) => candidate.id === message.id)
      )
        return conversation;
      return { ...conversation, messages: [...conversation.messages, message] };
    }),
    pendingMessageIds: state.pendingMessageIds.filter(
      (id) => id !== message.clientId,
    ),
  };
}

function applyPresence(state: ChatState, user: PublicUser): Partial<ChatState> {
  const profiles = state.profiles.some((profile) => profile.id === user.id)
    ? state.profiles.map((profile) => (profile.id === user.id ? user : profile))
    : [...state.profiles, user];
  const conversations = state.conversations.map((conversation) =>
    conversation.contact.id === user.id
      ? { ...conversation, contact: user }
      : conversation,
  );
  const membersOnline = profiles.filter(
    (profile) => profile.presence !== "offline",
  ).length;
  return {
    currentUser: state.currentUser?.id === user.id ? user : state.currentUser,
    profiles,
    conversations,
    channels: state.channels.map((channel) => ({ ...channel, membersOnline })),
  };
}

function applyFriendship(
  state: ChatState,
  friendship: Friendship,
): Partial<ChatState> {
  const friendships = state.friendships.some(
    (candidate) => candidate.id === friendship.id,
  )
    ? state.friendships.map((candidate) =>
        candidate.id === friendship.id ? friendship : candidate,
      )
    : [...state.friendships, friendship];
  const contactId =
    friendship.requesterId === state.currentUser?.id
      ? friendship.addresseeId
      : friendship.requesterId;
  if (friendship.status !== "accepted") {
    return {
      friendships,
      ...(friendship.status === "blocked"
        ? closeConversationState(state, contactId)
        : {}),
    };
  }
  const profile = state.profiles.find(
    (candidate) => candidate.id === contactId,
  );
  if (
    !profile ||
    state.conversations.some((item) => item.contact.id === contactId)
  )
    return { friendships };
  return {
    friendships,
    conversations: [
      ...state.conversations,
      { contact: profile, unread: 0, messages: [] },
    ],
  };
}

function upsertConversation(
  state: ChatState,
  conversation: Conversation,
  activate: boolean,
): Partial<ChatState> {
  const conversations = state.conversations.some(
    (candidate) => candidate.contact.id === conversation.contact.id,
  )
    ? state.conversations.map((candidate) =>
        candidate.contact.id === conversation.contact.id
          ? conversation
          : candidate,
      )
    : [...state.conversations, conversation];
  return {
    conversations,
    ...(activate
      ? {
          activeContactId: conversation.contact.id,
          view: "conversations" as const,
        }
      : {}),
  };
}

function closeConversationState(
  state: ChatState,
  contactId: string,
): Partial<ChatState> {
  const conversations = state.conversations.filter(
    (conversation) => conversation.contact.id !== contactId,
  );
  return {
    conversations,
    activeContactId:
      state.activeContactId === contactId
        ? conversations[0]?.contact.id
        : state.activeContactId,
  };
}

function updateMessage(
  state: ChatState,
  message: ChatMessage,
): Partial<ChatState> {
  if (message.scope === "channel") {
    return {
      channelMessages: {
        ...state.channelMessages,
        [message.targetId]: (state.channelMessages[message.targetId] ?? []).map(
          (candidate) => (candidate.id === message.id ? message : candidate),
        ),
      },
    };
  }
  return {
    conversations: state.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((candidate) =>
        candidate.id === message.id ? message : candidate,
      ),
    })),
  };
}

function deleteMessage(
  state: ChatState,
  messageId: string,
): Partial<ChatState> {
  return {
    channelMessages: Object.fromEntries(
      Object.entries(state.channelMessages).map(([channelId, messages]) => [
        channelId,
        messages.filter((message) => message.id !== messageId),
      ]),
    ),
    conversations: state.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.filter(
        (message) => message.id !== messageId,
      ),
    })),
  };
}

function removeProfile(state: ChatState, userId: string): Partial<ChatState> {
  const conversations = state.conversations.filter(
    (conversation) => conversation.contact.id !== userId,
  );
  return {
    profiles: state.profiles.filter((profile) => profile.id !== userId),
    conversations,
    friendships: state.friendships.filter(
      (friendship) =>
        friendship.requesterId !== userId && friendship.addresseeId !== userId,
    ),
    activeContactId:
      state.activeContactId === userId
        ? conversations[0]?.contact.id
        : state.activeContactId,
  };
}
