import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, SendHorizontal, SmilePlus, Trash2 } from "lucide-react";

import type { ChatMessage, PublicUser } from "@terminal-chat/protocol";

import { EmojiPicker } from "./EmojiPicker";
import { scrollMessageListToBottom } from "./scrollMessageList";

interface ChatPanelProps {
  title: string;
  subtitle: string;
  messages: ChatMessage[];
  currentUser?: PublicUser;
  onSend: (body: string) => boolean;
  onEditMessage: (messageId: string, body: string) => boolean;
  onDeleteMessage: (messageId: string) => boolean;
  pendingMessageIds: string[];
  voiceBar: React.ReactNode;
}

export function ChatPanel({
  title,
  subtitle,
  messages,
  currentUser,
  onSend,
  onEditMessage,
  onDeleteMessage,
  pendingMessageIds,
  voiceBar,
}: ChatPanelProps) {
  const [body, setBody] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // WebView2 can expose a numeric native return value here. An implicit
    // return would make React treat that number as this effect's cleanup.
    scrollMessageListToBottom(bottom.current);
  }, [messages.length]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = body.trim();
    if (!message || !onSend(message)) return;
    setBody("");
  }

  function insertEmoji(emoji: string) {
    const input = composer.current;
    const start = input?.selectionStart ?? body.length;
    const end = input?.selectionEnd ?? start;
    setBody(`${body.slice(0, start)}${emoji}${body.slice(end)}`);
    setShowEmojis(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="live-pill">
          <span /> tempo real
        </div>
      </header>
      <div className="message-list" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h3>Comece a conversa</h3>
            <p>As novas mensagens aparecerão aqui em tempo real.</p>
          </div>
        )}
        {messages.map((message) => {
          const mine = message.author.id === currentUser?.id;
          const pending = Boolean(
            message.clientId && pendingMessageIds.includes(message.clientId),
          );
          return (
            <article
              className={mine ? "message mine" : "message"}
              key={message.id}
            >
              <span className={`presence ${message.author.presence}`} />
              <div>
                <p className="message-meta">
                  <strong>{mine ? "Você" : message.author.displayName}</strong>
                  <time>{formatTime(message.createdAt)}</time>
                  {message.editedAt && <small>editada</small>}
                  {pending && <small>enviando…</small>}
                </p>
                <p className="message-body">{message.body}</p>
                {mine && !pending && (
                  <div className="message-actions">
                    <button
                      aria-label="Editar mensagem"
                      onClick={() => {
                        const body = window
                          .prompt("Editar mensagem", message.body)
                          ?.trim();
                        if (body && body !== message.body)
                          onEditMessage(message.id, body);
                      }}
                      title="Editar"
                      type="button"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label="Excluir mensagem"
                      className="danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Excluir esta mensagem para todos permanentemente?",
                          )
                        )
                          onDeleteMessage(message.id);
                      }}
                      title="Excluir"
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        <div ref={bottom} />
      </div>
      {voiceBar}
      <form className="composer" onSubmit={submit}>
        {showEmojis && <EmojiPicker onPick={insertEmoji} />}
        <button
          aria-expanded={showEmojis}
          aria-label="Abrir emojis"
          className="emoji-button"
          onClick={() => setShowEmojis((value) => !value)}
          title="Emojis — Win+."
          type="button"
        >
          <SmilePlus size={19} />
        </button>
        <textarea
          aria-label="Mensagem"
          maxLength={4_000}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.metaKey && event.key === ".") {
              event.preventDefault();
              setShowEmojis((value) => !value);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={`Mensagem para ${title}`}
          rows={1}
          ref={composer}
          value={body}
        />
        <button
          aria-label="Enviar mensagem"
          className="send-button"
          disabled={!body.trim()}
          type="submit"
        >
          <SendHorizontal size={19} />
        </button>
      </form>
    </section>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
