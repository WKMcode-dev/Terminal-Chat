import { useState, type FormEvent } from "react";
import { UserRoundPen, X } from "lucide-react";

import type { Presence, PublicUser } from "@terminal-chat/protocol";

export interface ProfileEditorValue {
  displayName: string;
  bio: string;
  avatar: string;
  activity: string;
  presence: Exclude<Presence, "offline">;
}

interface ProfileEditorProps {
  profile: PublicUser;
  error?: string;
  onClose: () => void;
  onSave: (value: ProfileEditorValue) => void;
}

export function ProfileEditor({
  profile,
  error,
  onClose,
  onSave,
}: ProfileEditorProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [activity, setActivity] = useState(profile.activity);
  const [presence, setPresence] = useState<Exclude<Presence, "offline">>(
    profile.presence === "offline" ? "online" : profile.presence,
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ displayName, bio, avatar, activity, presence });
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="profile-editor-title"
        aria-modal="true"
        className="dialog"
        role="dialog"
      >
        <header>
          <span className="dialog-icon">
            <UserRoundPen size={20} />
          </span>
          <div>
            <h2 id="profile-editor-title">Editar perfil</h2>
            <p>As alterações aparecem nos dois clientes em tempo real.</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="profile-editor-row">
            <label className="avatar-field">
              Avatar
              <input
                maxLength={16}
                onChange={(event) => setAvatar(event.target.value)}
                placeholder="🦊"
                value={avatar}
              />
            </label>
            <label>
              Nome de exibição
              <input
                autoFocus
                maxLength={40}
                minLength={2}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          </div>
          <label>
            Sobre você
            <textarea
              maxLength={240}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Conte um pouco sobre você..."
              rows={3}
              value={bio}
            />
          </label>
          <label>
            Atividade atual
            <input
              maxLength={120}
              onChange={(event) => setActivity(event.target.value)}
              placeholder="Jogando Valorant"
              value={activity}
            />
          </label>
          <label>
            Presença
            <select
              onChange={(event) =>
                setPresence(event.target.value as Exclude<Presence, "offline">)
              }
              value={presence}
            >
              <option value="online">Online</option>
              <option value="away">Ausente</option>
              <option value="busy">Ocupado</option>
            </select>
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
            <button className="primary-button compact" type="submit">
              Salvar perfil
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
