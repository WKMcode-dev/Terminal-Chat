mod app;
mod channels;
mod chat;
mod commands;
mod events;
mod friends;
mod platform;
mod protocol;
mod network;
mod profiles;
mod session;
mod settings;
mod ui;
mod voice;

use anyhow::{Result, anyhow};
use app::App;

fn main() -> Result<()> {
    install_crypto_provider()?;
    let (session, realtime) = session::connect_interactively()?;
    ui::terminal::run(App::from_session(session, realtime))
}

fn install_crypto_provider() -> Result<()> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        rustls::crypto::ring::default_provider()
            .install_default()
            .map_err(|_| anyhow!("não foi possível ativar o provedor criptográfico TLS"))?;
    }
    Ok(())
}
