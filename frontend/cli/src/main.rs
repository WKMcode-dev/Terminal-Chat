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

use anyhow::Result;
use app::App;

fn main() -> Result<()> {
    let (session, realtime) = session::connect_interactively()?;
    ui::terminal::run(App::from_session(session, realtime))
}
