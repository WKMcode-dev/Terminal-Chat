import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { LoginScreen } from "./components/auth/LoginScreen";
import { AppShell } from "./components/layout/AppShell";
import { api, ApiRequestError } from "./services/api";
import { RealtimeClient } from "./services/realtime";
import { useChatStore } from "./store/chatStore";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/forms.css";

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    sessionStorage.getItem("terminal-chat-token"),
  );
  const [realtime, setRealtime] = useState<RealtimeClient>();
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [connectionError, setConnectionError] = useState<string>();
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const hydrate = useChatStore((state) => state.hydrate);
  const clear = useChatStore((state) => state.clear);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    let createdClient: RealtimeClient | undefined;
    void api
      .bootstrap(accessToken)
      .then((bootstrap) => {
        if (cancelled) return;
        hydrate(bootstrap);
        const client = new RealtimeClient(accessToken);
        createdClient = client;
        client.connect();
        setRealtime(client);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          createdClient?.close();
          setRealtime(undefined);
          if (reason instanceof ApiRequestError && reason.status === 401) {
            setAccessToken(null);
            sessionStorage.removeItem("terminal-chat-token");
            clear();
          } else {
            setConnectionError(
              reason instanceof Error
                ? reason.message
                : "Não foi possível abrir o painel",
            );
          }
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      createdClient?.close();
    };
  }, [accessToken, clear, connectionAttempt, hydrate]);

  function authenticated(token: string) {
    setConnectionError(undefined);
    setAccessToken(token);
    setLoading(true);
  }

  function logout() {
    realtime?.close();
    setRealtime(undefined);
    setAccessToken(null);
    setLoading(false);
    sessionStorage.removeItem("terminal-chat-token");
    clear();
  }

  if (loading) {
    return (
      <main className="splash">
        <LoaderCircle className="spin" size={30} />
        <strong>Conectando ao Terminal Chat...</strong>
      </main>
    );
  }
  if (!accessToken) return <LoginScreen onAuthenticated={authenticated} />;
  if (connectionError)
    return (
      <main className="splash connection-failure">
        <strong>Não foi possível carregar o painel</strong>
        <p>{connectionError}</p>
        <div>
          <button
            className="primary-button compact"
            onClick={() => {
              setConnectionError(undefined);
              setLoading(true);
              setConnectionAttempt((value) => value + 1);
            }}
            type="button"
          >
            Tentar novamente
          </button>
          <button className="secondary-button" onClick={logout} type="button">
            Voltar ao login
          </button>
        </div>
      </main>
    );
  if (!realtime)
    return (
      <main className="splash">
        <p>Servidor indisponível.</p>
        <button className="secondary-button" onClick={logout}>
          Voltar ao login
        </button>
      </main>
    );
  return (
    <AppShell accessToken={accessToken} onLogout={logout} realtime={realtime} />
  );
}

export default App;
