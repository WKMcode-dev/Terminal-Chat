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
  hydrate: (bootstrap: Bootstrap) => void;
  applyEvent: (event: ServerEvent) => void;
  setView: (view: AppView) => void;
  selectChannel: (id: string) => void;
  selectContact: (id: string) => void;
  addChannel: (channel: Channel) => void;
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

  hydrate: (bootstrap) =>
    set((state) => ({
      currentUser: bootstrap.self,
      channels: bootstrap.channels,
      profiles: bootstrap.profiles,
      conversations: bootstrap.conversations,
      friendships: bootstrap.friendships,
      channelMessages: bootstrap.channelMessages,
      activeChannelId: state.activeChannelId ?? bootstrap.channels[0]?.id,
      activeContactId:
        state.activeContactId ?? bootstrap.conversations[0]?.contact.id,
      connected: true,
      notice: undefined,
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
            activeChannelId:
              state.activeChannelId ?? event.payload.bootstrap.channels[0]?.id,
            activeContactId:
              state.activeContactId ??
              event.payload.bootstrap.conversations[0]?.contact.id,
            connected: true,
            notice: undefined,
          };
        case "message.created":
          return insertMessage(state, event.payload);
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
          return {
            friendships: state.friendships.some(
              (friendship) => friendship.id === event.payload.id,
            )
              ? state.friendships.map((friendship) =>
                  friendship.id === event.payload.id
                    ? event.payload
                    : friendship,
                )
              : [...state.friendships, event.payload],
          };
        case "friendship.removed":
          return {
            friendships: state.friendships.filter(
              (friendship) =>
                !(
                  (friendship.requesterId === event.payload.userId &&
                    friendship.addresseeId === event.payload.otherUserId) ||
                  (friendship.requesterId === event.payload.otherUserId &&
                    friendship.addresseeId === event.payload.userId)
                ),
            ),
          };
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
  clear: () =>
    set({
      ...EMPTY,
      currentUser: undefined,
      connected: false,
      notice: undefined,
    }),
}));

function insertMessage(
  state: ChatState,
  message: ChatMessage,
): Partial<ChatState> {
  if (message.scope === "channel") {
    const messages = state.channelMessages[message.targetId] ?? [];
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
  return {
    conversations: state.conversations.map((conversation) => {
      if (conversation.contact.id !== contactId) return conversation;
      if (
        conversation.messages.some((candidate) => candidate.id === message.id)
      )
        return conversation;
      return { ...conversation, messages: [...conversation.messages, message] };
    }),
  };
}

function applyPresence(state: ChatState, user: PublicUser): Partial<ChatState> {
  const profiles = state.profiles.some((profile) => profile.id === user.id)
    ? state.profiles.map((profile) => (profile.id === user.id ? user : profile))
    : [...state.profiles, user];
  const conversations =
    user.id !== state.currentUser?.id &&
    !state.conversations.some(
      (conversation) => conversation.contact.id === user.id,
    )
      ? [...state.conversations, { contact: user, unread: 0, messages: [] }]
      : state.conversations.map((conversation) =>
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
