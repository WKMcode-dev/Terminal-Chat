import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error?: Error;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha ao renderizar o Terminal Chat", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-screen" role="alert">
        <div className="fatal-card">
          <p className="eyebrow">Recuperação da interface</p>
          <h1>O painel encontrou um erro</h1>
          <p>
            A tela foi interrompida com segurança em vez de permanecer preta.
            Recarregue o aplicativo; se continuar, limpe apenas a sessão local.
          </p>
          <code>{this.state.error.message || "Erro desconhecido"}</code>
          <div>
            <button
              className="primary-button compact"
              onClick={() => window.location.reload()}
              type="button"
            >
              Recarregar
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                sessionStorage.removeItem("terminal-chat-token");
                window.location.reload();
              }}
              type="button"
            >
              Limpar sessão
            </button>
          </div>
        </div>
      </main>
    );
  }
}
