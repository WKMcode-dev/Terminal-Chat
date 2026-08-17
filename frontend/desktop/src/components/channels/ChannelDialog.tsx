import { useState, type FormEvent } from "react";
import { Hash, X } from "lucide-react";

interface ChannelDialogProps {
  busy: boolean;
  error?: string;
  onClose: () => void;
  onCreate: (input: { name: string; description: string }) => void;
}

export function ChannelDialog({
  busy,
  error,
  onClose,
  onCreate,
}: ChannelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onCreate({ name, description });
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="channel-dialog-title"
        aria-modal="true"
        className="dialog"
        role="dialog"
      >
        <header>
          <span className="dialog-icon">
            <Hash size={20} />
          </span>
          <div>
            <h2 id="channel-dialog-title">Novo canal</h2>
            <p>Todos os usuários atuais poderão participar.</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Nome
            <input
              autoFocus
              maxLength={32}
              onChange={(event) => setName(event.target.value)}
              placeholder="meu-canal"
              required
              value={name}
            />
          </label>
          <label>
            Descrição
            <input
              maxLength={160}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Sobre o que vamos conversar?"
              value={description}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button
              className="secondary-button"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primary-button compact"
              disabled={busy}
              type="submit"
            >
              {busy ? "Criando..." : "Criar canal"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
