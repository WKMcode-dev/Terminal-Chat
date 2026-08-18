import { Bell, Moon, Palette, Volume2, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { AccountSettings } from "./AccountSettings";

interface Preferences {
  theme: "kitsune" | "notion-dark" | "notion-light";
  notifications: boolean;
  sounds: boolean;
  animations: boolean;
}

const INITIAL = loadPreferences();
document.documentElement.dataset.theme = INITIAL.theme;
document.documentElement.dataset.motion = INITIAL.animations ? "on" : "off";

interface SettingsPanelProps {
  username: string;
  onLogout: () => void;
  onDeleteAccount: (password: string) => Promise<void>;
}

export function SettingsPanel({
  username,
  onLogout,
  onDeleteAccount,
}: SettingsPanelProps) {
  const [preferences, setPreferences] = useState(INITIAL);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.motion = preferences.animations
      ? "on"
      : "off";
    localStorage.setItem(
      "terminal-chat-preferences",
      JSON.stringify(preferences),
    );
  }, [preferences]);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="content-panel settings-panel">
      <header className="section-heading">
        <p className="eyebrow">Seu espaço</p>
        <h1>Configurações</h1>
        <p>
          Preferências locais, compartilhando a mesma linguagem visual do
          terminal.
        </p>
      </header>
      <div className="settings-group">
        <Setting
          icon={<Palette size={19} />}
          title="Paleta da interface"
          description="Escolha uma tonalidade minimalista."
        >
          <select
            onChange={(event) =>
              update("theme", event.target.value as Preferences["theme"])
            }
            value={preferences.theme}
          >
            <option value="kitsune">Kitsune Night</option>
            <option value="notion-dark">Notion Dark</option>
            <option value="notion-light">Notion Light</option>
          </select>
        </Setting>
        <Setting
          icon={<Bell size={19} />}
          title="Notificações"
          description="Avisar sobre novas mensagens."
        >
          <Toggle
            checked={preferences.notifications}
            onChange={(value) => update("notifications", value)}
          />
        </Setting>
        <Setting
          icon={<Volume2 size={19} />}
          title="Sons"
          description="Tocar um aviso curto nas mensagens."
        >
          <Toggle
            checked={preferences.sounds}
            onChange={(value) => update("sounds", value)}
          />
        </Setting>
        <Setting
          icon={<WandSparkles size={19} />}
          title="Animações"
          description="Movimentos sutis e transições da interface."
        >
          <Toggle
            checked={preferences.animations}
            onChange={(value) => update("animations", value)}
          />
        </Setting>
      </div>
      <aside className="settings-note">
        <Moon size={18} />
        As preferências ficam salvas neste dispositivo.
      </aside>
      <AccountSettings
        onDelete={onDeleteAccount}
        onLogout={onLogout}
        username={username}
      />
    </section>
  );
}

function Setting({
  icon,
  title,
  description,
  children,
}: React.PropsWithChildren<{
  icon: React.ReactNode;
  title: string;
  description: string;
}>) {
  return (
    <div className="setting-row">
      <span className="setting-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={checked ? "toggle active" : "toggle"}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span />
    </button>
  );
}

function loadPreferences(): Preferences {
  try {
    const value = JSON.parse(
      localStorage.getItem("terminal-chat-preferences") ?? "{}",
    ) as Partial<Preferences>;
    return {
      theme: ["kitsune", "notion-dark", "notion-light"].includes(
        value.theme ?? "",
      )
        ? (value.theme as Preferences["theme"])
        : "kitsune",
      notifications: value.notifications ?? true,
      sounds: value.sounds ?? true,
      animations: value.animations ?? true,
    };
  } catch {
    return {
      theme: "kitsune",
      notifications: true,
      sounds: true,
      animations: true,
    };
  }
}
