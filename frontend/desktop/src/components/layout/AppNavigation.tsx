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
      <div className="mini-brand">TC</div>
      <div className="nav-items">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            aria-current={current === id ? "page" : undefined}
            className={current === id ? "nav-button active" : "nav-button"}
            key={id}
            onClick={() => onChange(id)}
            title={label}
            type="button"
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div
        className={connected ? "connection-dot online" : "connection-dot"}
        title={connected ? "Online" : "Reconectando"}
      />
      <button
        className="nav-button logout"
        onClick={onLogout}
        title="Sair"
        type="button"
      >
        <LogOut size={20} />
        <span>Sair</span>
      </button>
    </nav>
  );
}
