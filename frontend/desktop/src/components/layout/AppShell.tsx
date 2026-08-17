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
        if (event.type === "error" && event.payload.code === "INVALID_SESSION")
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
    if (store.view === "channels" && channel) {
      return realtime.send({
        type: "message.send",
        payload: {
          clientId: crypto.randomUUID(),
          scope: "channel",
          targetId: channel.id,
          body,
        },
      });
    }
    if (store.view === "conversations" && conversation) {
      return realtime.send({
        type: "message.send",
        payload: {
          clientId: crypto.randomUUID(),
          scope: "direct",
          targetId: conversation.contact.id,
          body,
        },
      });
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
            onMessage={store.selectContact}
            profiles={store.profiles}
            realtime={realtime}
          />
        )}
        {store.view === "settings" && <SettingsPanel />}
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
