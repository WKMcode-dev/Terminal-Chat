import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, MessageSquareDashed } from "lucide-react";

import { api } from "../../services/api";
import type { RealtimeClient } from "../../services/realtime";
import { useChatStore } from "../../store/chatStore";
import { useVoice } from "../../hooks/useVoice";
import { ChannelDialog } from "../channels/ChannelDialog";
import { ChatPanel } from "../chat/ChatPanel";
import { VoiceBar } from "../chat/VoiceBar";
import { ProfilesPanel } from "../profiles/ProfilesPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AppNavigation } from "./AppNavigation";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  accessToken: string;
  realtime: RealtimeClient;
  onLogout: () => void;
}

export function AppShell({ accessToken, realtime, onLogout }: AppShellProps) {
  const store = useChatStore();
  const [channelDialog, setChannelDialog] = useState(false);
  const [channelError, setChannelError] = useState<string>();
  const [creatingChannel, setCreatingChannel] = useState(false);
  const applyEvent = store.applyEvent;

  useEffect(
    () =>
      realtime.subscribe((event) => {
        applyEvent(event);
        if (
          event.type === "account.deleted" ||
          (event.type === "error" && event.payload.code === "INVALID_SESSION")
        )
          onLogout();
      }),
    [applyEvent, onLogout, realtime],
  );

  const channel = store.channels.find(
    (candidate) => candidate.id === store.activeChannelId,
  );
  const conversation = store.conversations.find(
    (candidate) => candidate.contact.id === store.activeContactId,
  );
  const target =
    store.view === "channels"
      ? channel
      : store.view === "conversations"
        ? conversation
        : undefined;
  const roomId = useMemo(() => {
    if (channel && store.view === "channels") return `channel:${channel.id}`;
    if (conversation && store.currentUser && store.view === "conversations") {
      return `direct:${[store.currentUser.id, conversation.contact.id].sort().join(":")}`;
    }
    return undefined;
  }, [channel, conversation, store.currentUser, store.view]);
  const voice = useVoice(realtime, roomId);

  function sendMessage(body: string): boolean {
    const clientId = crypto.randomUUID();
    if (store.view === "channels" && channel) {
      const input = {
        clientId,
        scope: "channel" as const,
        targetId: channel.id,
        body,
      };
      store.queueMessage(input);
      const sent = realtime.send({
        type: "message.send",
        payload: input,
      });
      if (!sent) store.failMessage(clientId);
      else window.setTimeout(() => store.failMessage(clientId), 15_000);
      return sent;
    }
    if (store.view === "conversations" && conversation) {
      const input = {
        clientId,
        scope: "direct" as const,
        targetId: conversation.contact.id,
        body,
      };
      store.queueMessage(input);
      const sent = realtime.send({
        type: "message.send",
        payload: input,
      });
      if (!sent) store.failMessage(clientId);
      else window.setTimeout(() => store.failMessage(clientId), 15_000);
      return sent;
    }
    return false;
  }

  async function createChannel(input: { name: string; description: string }) {
    setCreatingChannel(true);
    setChannelError(undefined);
    try {
      const created = await api.createChannel(accessToken, input);
      store.addChannel(created);
      setChannelDialog(false);
    } catch (reason) {
      setChannelError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o canal",
      );
    } finally {
      setCreatingChannel(false);
    }
  }

  async function deleteAccount(password: string) {
    if (!store.currentUser) throw new Error("Sessão de usuário indisponível");
    await api.deleteAccount(accessToken, {
      password,
      confirmation: store.currentUser.username,
    });
    onLogout();
  }

  return (
    <main className="app-shell">
      <AppNavigation
        current={store.view}
        connected={store.connected}
        onChange={store.setView}
        onLogout={onLogout}
      />
      <Sidebar
        activeChannelId={store.activeChannelId}
        activeContactId={store.activeContactId}
        channels={store.channels}
        conversations={store.conversations}
        onChannel={store.selectChannel}
        onContact={store.selectContact}
        onCloseConversation={(contactId) => {
          if (
            realtime.send({
              type: "conversation.close",
              payload: { userId: contactId },
            })
          )
            store.closeConversation(contactId);
        }}
        onCreateChannel={() => setChannelDialog(true)}
        view={store.view}
      />
      <section className="main-content">
        {store.view === "profiles" && (
          <ProfilesPanel
            currentUser={store.currentUser}
            friendships={store.friendships}
            onCall={(userId) => {
              store.selectContact(userId);
              if (store.currentUser) {
                const directRoom = `direct:${[store.currentUser.id, userId]
                  .sort()
                  .join(":")}`;
                void voice.join(directRoom);
              }
            }}
            onMessage={(userId) => {
              store.openConversation(userId);
              realtime.send({
                type: "conversation.open",
                payload: { userId },
              });
            }}
            profiles={store.profiles}
            realtime={realtime}
          />
        )}
        {store.view === "settings" && store.currentUser && (
          <SettingsPanel
            onDeleteAccount={deleteAccount}
            onLogout={onLogout}
            username={store.currentUser.username}
          />
        )}
        {(store.view === "channels" || store.view === "conversations") &&
          target && (
            <ChatPanel
              currentUser={store.currentUser}
              messages={
                store.view === "channels"
                  ? (store.channelMessages[channel!.id] ?? [])
                  : conversation!.messages
              }
              onSend={sendMessage}
              onDeleteMessage={(messageId) =>
                realtime.send({
                  type: "message.delete",
                  payload: { messageId },
                })
              }
              onEditMessage={(messageId, body) =>
                realtime.send({
                  type: "message.edit",
                  payload: { messageId, body },
                })
              }
              pendingMessageIds={store.pendingMessageIds}
              subtitle={
                store.view === "channels"
                  ? `${channel!.membersOnline} online • ${channel!.description}`
                  : conversation!.contact.activity ||
                    `@${conversation!.contact.username}`
              }
              title={
                store.view === "channels"
                  ? `#${channel!.name}`
                  : conversation!.contact.displayName
              }
              voiceBar={
                <VoiceBar
                  {...voice}
                  onDeafen={voice.setDeafened}
                  onJoin={() => void voice.join()}
                  onLeave={voice.leave}
                  onMute={voice.setMuted}
                  onTest={voice.toggleTest}
                />
              }
            />
          )}
        {(store.view === "channels" || store.view === "conversations") &&
          !target && (
            <div className="main-empty">
              <MessageSquareDashed size={34} />
              <h2>Nenhum item selecionado</h2>
              <p>Escolha uma conversa ou crie um canal.</p>
            </div>
          )}
      </section>
      {store.notice && (
        <div className="toast">
          <LoaderCircle size={16} />
          {store.notice}
        </div>
      )}
      {channelDialog && (
        <ChannelDialog
          busy={creatingChannel}
          error={channelError}
          onClose={() => setChannelDialog(false)}
          onCreate={(input) => void createChannel(input)}
        />
      )}
    </main>
  );
}
