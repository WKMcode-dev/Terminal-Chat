import { Hash, MessageCircle, Plus } from "lucide-react";

import type { Channel, Conversation } from "@terminal-chat/protocol";

import type { AppView } from "../../store/chatStore";

interface SidebarProps {
  view: AppView;
  channels: Channel[];
  conversations: Conversation[];
  activeChannelId?: string;
  activeContactId?: string;
  onChannel: (id: string) => void;
  onContact: (id: string) => void;
  onCreateChannel: () => void;
}

export function Sidebar(props: SidebarProps) {
  if (props.view !== "channels" && props.view !== "conversations") {
    return (
      <aside className="sidebar contextual">
        <p className="eyebrow">Terminal Chat</p>
        <h2>{props.view === "profiles" ? "Pessoas" : "Preferências"}</h2>
        <p>Gerencie esta área no painel principal.</p>
      </aside>
    );
  }

  const showingChannels = props.view === "channels";
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div>
          <p className="eyebrow">
            {showingChannels ? "Comunidade" : "Mensagens"}
          </p>
          <h2>{showingChannels ? "Canais" : "Conversas"}</h2>
        </div>
        {showingChannels && (
          <button
            className="icon-button"
            onClick={props.onCreateChannel}
            title="Novo canal"
            type="button"
          >
            <Plus size={18} />
          </button>
        )}
      </header>
      <div className="target-list">
        {showingChannels
          ? props.channels.map((channel) => (
              <button
                className={
                  props.activeChannelId === channel.id
                    ? "target active"
                    : "target"
                }
                key={channel.id}
                onClick={() => props.onChannel(channel.id)}
                type="button"
              >
                <Hash size={17} />
                <span>
                  <strong>{channel.name}</strong>
                  <small>{channel.description}</small>
                </span>
                {channel.unread > 0 && (
                  <b className="unread">{channel.unread}</b>
                )}
              </button>
            ))
          : props.conversations.map((conversation) => (
              <button
                className={
                  props.activeContactId === conversation.contact.id
                    ? "target active"
                    : "target"
                }
                key={conversation.contact.id}
                onClick={() => props.onContact(conversation.contact.id)}
                type="button"
              >
                <span className={`presence ${conversation.contact.presence}`} />
                <span>
                  <strong>{conversation.contact.displayName}</strong>
                  <small>
                    {conversation.contact.activity ||
                      `@${conversation.contact.username}`}
                  </small>
                </span>
                {conversation.unread > 0 && (
                  <b className="unread">{conversation.unread}</b>
                )}
              </button>
            ))}
        {((showingChannels && props.channels.length === 0) ||
          (!showingChannels && props.conversations.length === 0)) && (
          <div className="list-empty">
            <MessageCircle size={22} />
            Nada por aqui ainda.
          </div>
        )}
      </div>
    </aside>
  );
}
