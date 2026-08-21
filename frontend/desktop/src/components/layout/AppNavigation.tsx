import {
  Hash,
  LogOut,
  MessagesSquare,
  Settings,
  UsersRound,
} from "lucide-react";

import type { AppView } from "../../store/chatStore";

interface AppNavigationProps {
  current: AppView;
  connected: boolean;
  onChange: (view: AppView) => void;
  onLogout: () => void;
}

const items = [
  { id: "conversations" as const, label: "Conversas", icon: MessagesSquare },
  { id: "channels" as const, label: "Canais", icon: Hash },
  { id: "profiles" as const, label: "Perfis", icon: UsersRound },
  { id: "settings" as const, label: "Configurações", icon: Settings },
];

export function AppNavigation({
  current,
  connected,
  onChange,
  onLogout,
}: AppNavigationProps) {
  return (
    <nav className="app-navigation" aria-label="Áreas do aplicativo">
      <div className="mini-brand" aria-label="Terminal Chat">
        <span>TC</span>
        <small>LINK</small>
      </div>
      <div className="nav-items">
        {items.map(({ id, label, icon: Icon }, index) => (
          <button
            aria-current={current === id ? "page" : undefined}
            className={current === id ? "nav-button active" : "nav-button"}
            key={id}
            onClick={() => onChange(id)}
            title={label}
            type="button"
          >
            <span className="nav-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="nav-icon" aria-hidden="true">
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </div>
      <div className="nav-footer">
        <div
          className={
            connected ? "connection-status online" : "connection-status"
          }
          role="status"
          title={connected ? "Online" : "Reconectando"}
        >
          <span className="connection-dot" />
          <span>{connected ? "Online" : "Conectando"}</span>
        </div>
        <button
          aria-label="Sair"
          className="nav-button logout"
          onClick={onLogout}
          title="Sair"
          type="button"
        >
          <span className="nav-icon" aria-hidden="true">
            <LogOut size={19} strokeWidth={1.8} />
          </span>
          <span className="nav-label">Sair</span>
        </button>
      </div>
    </nav>
  );
}
