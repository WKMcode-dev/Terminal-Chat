import { LogOut, ShieldAlert, Trash2, X } from "lucide-react";
import { useState } from "react";

interface AccountSettingsProps {
  username: string;
  onLogout: () => void;
  onDelete: (password: string) => Promise<void>;
}

export function AccountSettings({
  username,
  onLogout,
  onDelete,
}: AccountSettingsProps) {
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const requiredConfirmation = `EXCLUIR @${username}`;
  const canDelete =
    confirmation.trim() === requiredConfirmation && password.length >= 8;

  function closeDialog() {
    if (busy) return;
    setDeleting(false);
    setConfirmation("");
    setPassword("");
    setError(undefined);
  }

  async function deleteAccount() {
    if (!canDelete || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onDelete(password);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível excluir a conta",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <div className="account-settings">
        <div>
          <strong>Conta e sessão</strong>
          <small>
            Entre com outro usuário ou remova permanentemente seus dados.
          </small>
        </div>
        <div className="account-actions">
          <button className="secondary-button" onClick={onLogout} type="button">
            <LogOut size={16} />
            Sair e trocar conta
          </button>
          <button
            className="danger-button"
            onClick={() => setDeleting(true)}
            type="button"
          >
            <Trash2 size={16} />
            Excluir conta
          </button>
        </div>
      </div>

      {deleting && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-account-title"
            aria-modal="true"
            className="dialog delete-account-dialog"
            role="dialog"
          >
            <header>
              <span className="dialog-icon danger">
                <ShieldAlert size={21} />
              </span>
              <div>
                <p className="eyebrow">Ação permanente</p>
                <h2 id="delete-account-title">Excluir sua conta?</h2>
              </div>
              <button
                aria-label="Cancelar exclusão"
                className="icon-button"
                disabled={busy}
                onClick={closeDialog}
                type="button"
              >
                <X size={17} />
              </button>
            </header>
            <div className="dialog-body">
              <p>
                Seu perfil, amizades e mensagens serão apagados do servidor e
                não poderão ser recuperados.
              </p>
              <label>
                Digite <strong>{requiredConfirmation}</strong>
                <input
                  autoComplete="off"
                  autoFocus
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.target.value)}
                  spellCheck={false}
                  value={confirmation}
                />
              </label>
              <label>
                Confirme sua senha
                <input
                  autoComplete="current-password"
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>
              {error && <p className="form-error">{error}</p>}
            </div>
            <footer className="dialog-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={closeDialog}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="danger-button"
                disabled={!canDelete || busy}
                onClick={() => void deleteAccount()}
                type="button"
              >
                <Trash2 size={16} />
                {busy ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
