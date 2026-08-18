import { useState, type FormEvent } from "react";
import {
  ChevronDown,
  Database,
  LockKeyhole,
  Radio,
  UserRoundPlus,
} from "lucide-react";

import { api } from "../../services/api";
import {
  getServerHttpUrl,
  setServerHttpUrl,
} from "../../services/serverConfig";

interface LoginScreenProps {
  onAuthenticated: (accessToken: string) => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(getServerHttpUrl);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      setServerUrl(setServerHttpUrl(serverUrl));
      const session = registering
        ? await api.register({ username, displayName, password })
        : await api.login({ username, password });
      sessionStorage.setItem("terminal-chat-token", session.accessToken);
      onAuthenticated(session.accessToken);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível conectar ao servidor",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark">
          <Radio size={26} />
        </div>
        <p className="eyebrow">Terminal Chat v2.3.0</p>
        <h1 id="auth-title">
          {registering ? "Crie sua conta" : "Bem-vindo de volta"}
        </h1>
        <p className="auth-description">
          Mensagens e voz em tempo real, no terminal e no desktop.
        </p>
        <form onSubmit={submit}>
          {registering && (
            <label>
              Nome de exibição
              <input
                autoComplete="name"
                maxLength={40}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          )}
          <label>
            Usuário
            <input
              autoCapitalize="none"
              autoComplete="username"
              maxLength={24}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label>
            Senha
            <input
              autoComplete={registering ? "new-password" : "current-password"}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={loading} type="submit">
            {registering ? (
              <UserRoundPlus size={17} />
            ) : (
              <LockKeyhole size={17} />
            )}
            {loading
              ? "Conectando..."
              : registering
                ? "Criar e entrar"
                : "Entrar"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => setRegistering((value) => !value)}
          type="button"
        >
          {registering ? "Já tenho uma conta" : "Quero criar uma conta"}
        </button>
        <button
          aria-expanded={showServer}
          className="server-toggle"
          onClick={() => setShowServer((value) => !value)}
          type="button"
        >
          <Database size={15} />
          <span>
            <small>Servidor</small>
            {new URL(getServerHttpUrl()).host}
          </span>
          <ChevronDown size={15} />
        </button>
        {showServer && (
          <label className="server-field">
            Endereço da comunidade
            <input
              autoCapitalize="none"
              autoComplete="url"
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="https://terminal-chat.koyeb.app"
              spellCheck={false}
              value={serverUrl}
            />
            <small>Use HTTP somente para o servidor local.</small>
          </label>
        )}
      </section>
    </main>
  );
}
