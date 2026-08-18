use std::{
    env, fs,
    io::{self, Write},
};

use anyhow::{Context, Result, anyhow};
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind, KeyModifiers},
    terminal::{disable_raw_mode, enable_raw_mode},
};

use crate::{
    network::RealtimeClient,
    protocol::{ClientEvent, SessionReady},
};

const KEYRING_SERVICE: &str = "terminal-chat";
const KEYRING_ACCOUNT: &str = "session";

pub fn connect_interactively() -> Result<(SessionReady, RealtimeClient)> {
    let server_url = configured_server_url();

    if let Some(token) = saved_token() {
        match RealtimeClient::connect(
            server_url.clone(),
            ClientEvent::AuthResume { access_token: token },
        ) {
            Ok(session) => return Ok(session),
            Err(_) => delete_saved_token(),
        }
    }

    println!("\nTerminal Chat v2.2.1 — conexão segura");
    println!("Servidor: {server_url}\n");
    for _ in 0..3 {
        let mode = read_line("[1] Entrar  [2] Criar conta: ")?;
        let authentication = if mode.trim() == "2" {
            let display_name = read_line("Nome de exibição: ")?;
            let username = read_line("Usuário: ")?;
            let password = read_secret("Senha (mínimo 8 caracteres): ")?;
            ClientEvent::AuthRegister {
                display_name: display_name.trim().to_owned(),
                username: username.trim().to_owned(),
                password,
            }
        } else {
            let username = read_line("Usuário: ")?;
            let password = read_secret("Senha: ")?;
            ClientEvent::AuthLogin {
                username: username.trim().to_owned(),
                password,
            }
        };

        match RealtimeClient::connect(server_url.clone(), authentication) {
            Ok((session, client)) => {
                save_token(&session.access_token);
                return Ok((session, client));
            }
            Err(error) => eprintln!("\nNão foi possível entrar: {error}\n"),
        }
    }
    Err(anyhow!("limite de tentativas de autenticação atingido"))
}

fn configured_server_url() -> String {
    env::var("TERMINAL_CHAT_SERVER")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| dotenv_value("TERMINAL_CHAT_SERVER"))
        .unwrap_or_else(|| "ws://127.0.0.1:3000/ws".to_owned())
}

fn dotenv_value(key: &str) -> Option<String> {
    let current_directory = env::current_dir().ok()?;
    for directory in current_directory.ancestors() {
        let Ok(contents) = fs::read_to_string(directory.join(".env")) else {
            continue;
        };
        if let Some(value) = parse_dotenv_value(&contents, key) {
            return Some(value);
        }
    }
    None
}

fn parse_dotenv_value(contents: &str, key: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            return None;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let (candidate_key, raw_value) = line.split_once('=')?;
        if candidate_key.trim() != key {
            return None;
        }
        let value = raw_value.trim();
        let value = value
            .strip_prefix('"')
            .and_then(|value| value.strip_suffix('"'))
            .or_else(|| {
                value
                    .strip_prefix('\'')
                    .and_then(|value| value.strip_suffix('\''))
            })
            .unwrap_or(value);
        (!value.is_empty()).then(|| value.to_owned())
    })
}

fn read_line(prompt: &str) -> Result<String> {
    print!("{prompt}");
    io::stdout().flush()?;
    let mut value = String::new();
    io::stdin().read_line(&mut value)?;
    Ok(value.trim_end_matches(['\r', '\n']).to_owned())
}

fn read_secret(prompt: &str) -> Result<String> {
    print!("{prompt}");
    io::stdout().flush()?;
    if enable_raw_mode().is_err() {
        return read_line("");
    }
    let mut guard = RawModeGuard;
    let mut password = String::new();
    loop {
        let Event::Key(key) = event::read().context("não foi possível ler a senha")? else {
            continue;
        };
        if !matches!(key.kind, KeyEventKind::Press | KeyEventKind::Repeat) {
            continue;
        }
        match key.code {
            KeyCode::Enter => {
                guard.restore();
                println!();
                return Ok(password);
            }
            KeyCode::Backspace => {
                if password.pop().is_some() {
                    print!("\x08 \x08");
                    io::stdout().flush()?;
                }
            }
            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                return Err(anyhow!("autenticação cancelada"));
            }
            KeyCode::Char(character) if !character.is_control() => {
                password.push(character);
                print!("•");
                io::stdout().flush()?;
            }
            _ => {}
        }
    }
}

struct RawModeGuard;

impl RawModeGuard {
    fn restore(&mut self) {
        let _ = disable_raw_mode();
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        self.restore();
    }
}

fn saved_token() -> Option<String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .ok()?
        .get_password()
        .ok()
}

fn save_token(token: &str) {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT) {
        let _ = entry.set_password(token);
    }
}

fn delete_saved_token() {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT) {
        let _ = entry.delete_credential();
    }
}

#[cfg(test)]
mod tests {
    use super::parse_dotenv_value;

    #[test]
    fn reads_server_url_from_dotenv_contents() {
        let contents = r#"
            # servidor da comunidade
            TERMINAL_CHAT_SERVER="wss://terminal-chat.example/ws"
        "#;

        assert_eq!(
            parse_dotenv_value(contents, "TERMINAL_CHAT_SERVER").as_deref(),
            Some("wss://terminal-chat.example/ws")
        );
    }
}
