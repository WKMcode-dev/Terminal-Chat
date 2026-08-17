import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { LoginScreen } from "./components/auth/LoginScreen";
import { AppShell } from "./components/layout/AppShell";
import { api } from "./services/api";
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
      .catch(() => {
        if (!cancelled) {
          createdClient?.close();
          setRealtime(undefined);
          setAccessToken(null);
          sessionStorage.removeItem("terminal-chat-token");
          clear();
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      createdClient?.close();
    };
  }, [accessToken, clear, hydrate]);

  function authenticated(token: string) {
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
