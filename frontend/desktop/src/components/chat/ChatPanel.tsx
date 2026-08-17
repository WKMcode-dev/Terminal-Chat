import { useEffect, useRef, useState, type FormEvent } from "react";
import { SendHorizontal } from "lucide-react";

import type { ChatMessage, PublicUser } from "@terminal-chat/protocol";

interface ChatPanelProps {
  title: string;
  subtitle: string;
  messages: ChatMessage[];
  currentUser?: PublicUser;
  onSend: (body: string) => boolean;
  voiceBar: React.ReactNode;
}

export function ChatPanel({
  title,
  subtitle,
  messages,
  currentUser,
  onSend,
  voiceBar,
}: ChatPanelProps) {
  const [body, setBody] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(
    () => bottom.current?.scrollIntoView({ behavior: "smooth" }),
    [messages.length],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = body.trim();
    if (!message || !onSend(message)) return;
    setBody("");
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
                </p>
                <p className="message-body">{message.body}</p>
              </div>
            </article>
          );
        })}
        <div ref={bottom} />
      </div>
      {voiceBar}
      <form className="composer" onSubmit={submit}>
        <textarea
          aria-label="Mensagem"
          maxLength={4_000}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={`Mensagem para ${title}`}
          rows={1}
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
