use std::{
    sync::mpsc::{self, Receiver, RecvTimeoutError, TryRecvError},
    thread,
    time::Duration,
};

use anyhow::{Context, Result, anyhow};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::protocol::{ClientEvent, ServerEvent, SessionReady, WireError};

pub struct RealtimeClient {
    commands: UnboundedSender<ClientEvent>,
    events: Receiver<ServerEvent>,
}

impl RealtimeClient {
    pub fn connect(server_url: String, authentication: ClientEvent) -> Result<(SessionReady, Self)> {
        let remote_server = !server_url.contains("127.0.0.1") && !server_url.contains("localhost");
        let startup_timeout = if remote_server { 90 } else { 20 };
        let connection_attempts = if remote_server { 140 } else { 20 };
        let (command_sender, command_receiver) = tokio::sync::mpsc::unbounded_channel();
        let (event_sender, event_receiver) = mpsc::channel();
        let (ready_sender, ready_receiver) = mpsc::sync_channel(1);

        thread::Builder::new()
            .name("terminal-chat-realtime".to_owned())
            .spawn(move || {
                let runtime = tokio::runtime::Runtime::new();
                match runtime {
                    Ok(runtime) => runtime.block_on(run_actor(
                        server_url,
                        authentication,
                        command_receiver,
                        event_sender,
                        ready_sender,
                        connection_attempts,
                    )),
                    Err(error) => {
                        let _ = ready_sender.send(Err(format!(
                            "não foi possível iniciar a rede assíncrona: {error}"
                        )));
                    }
                }
            })
            .context("não foi possível iniciar o cliente em tempo real")?;

        let session = match ready_receiver.recv_timeout(Duration::from_secs(startup_timeout)) {
            Ok(Ok(session)) => session,
            Ok(Err(message)) => return Err(anyhow!(message)),
            Err(RecvTimeoutError::Timeout) => {
                return Err(anyhow!("o servidor demorou demais para responder"));
            }
            Err(RecvTimeoutError::Disconnected) => {
                return Err(anyhow!("a conexão terminou antes da autenticação"));
            }
        };

        Ok((
            session,
            Self {
                commands: command_sender,
                events: event_receiver,
            },
        ))
    }

    pub fn send(&self, event: ClientEvent) -> Result<()> {
        self.commands
            .send(event)
            .map_err(|_| anyhow!("a conexão com o servidor foi encerrada"))
    }

    pub fn try_receive(&self) -> Option<ServerEvent> {
        match self.events.try_recv() {
            Ok(event) => Some(event),
            Err(TryRecvError::Empty | TryRecvError::Disconnected) => None,
        }
    }

    pub fn sender(&self) -> UnboundedSender<ClientEvent> {
        self.commands.clone()
    }
}

async fn run_actor(
    server_url: String,
    authentication: ClientEvent,
    mut commands: UnboundedReceiver<ClientEvent>,
    events: mpsc::Sender<ServerEvent>,
    ready: mpsc::SyncSender<Result<SessionReady, String>>,
    connection_attempts: usize,
) {
    let (mut socket, session) = match authenticate_with_retry(
        &server_url,
        authentication,
        connection_attempts,
    )
    .await
    {
        Ok(connection) => connection,
        Err(error) => {
            let _ = ready.send(Err(error.to_string()));
            return;
        }
    };
    let access_token = session.access_token.clone();
    let mut joined_room: Option<String> = None;
    if ready.send(Ok(session)).is_err() {
        return;
    }

    loop {
        if run_connected(&mut socket, &mut commands, &events, &mut joined_room).await {
            return;
        }

        let _ = events.send(ServerEvent::Error(WireError {
            code: "RECONNECTING".to_owned(),
            message: "Conexão perdida; tentando reconectar...".to_owned(),
            request_id: None,
        }));
        let resume = ClientEvent::AuthResume {
            access_token: access_token.clone(),
        };
        match authenticate_with_retry(&server_url, resume, 140).await {
            Ok((new_socket, new_session)) => {
                socket = new_socket;
                if let Some(room_id) = joined_room.clone() {
                    let event = ClientEvent::VoiceJoin { room_id };
                    if let Ok(payload) = serde_json::to_string(&event) {
                        let _ = socket.send(Message::Text(payload.into())).await;
                    }
                }
                let _ = events.send(ServerEvent::SessionReady(new_session));
            }
            Err(error) => {
                let _ = events.send(ServerEvent::Error(WireError {
                    code: "CONNECTION_LOST".to_owned(),
                    message: format!("Não foi possível reconectar: {error}"),
                    request_id: None,
                }));
                return;
            }
        }
    }
}

async fn authenticate_with_retry(
    server_url: &str,
    authentication: ClientEvent,
    attempts: usize,
) -> Result<(
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    SessionReady,
)> {
    let mut last_error = None;
    for attempt in 0..attempts {
        match connect_async(server_url).await {
            Ok((mut socket, _)) => {
                let payload = serde_json::to_string(&authentication)?;
                socket.send(Message::Text(payload.into())).await?;
                let response = tokio::time::timeout(Duration::from_secs(10), socket.next())
                    .await
                    .context("tempo de autenticação excedido")?
                    .ok_or_else(|| anyhow!("servidor encerrou a autenticação"))??;
                let Message::Text(text) = response else {
                    return Err(anyhow!("resposta de autenticação inesperada"));
                };
                return match serde_json::from_str::<ServerEvent>(&text)? {
                    ServerEvent::SessionReady(session) => Ok((socket, session)),
                    ServerEvent::Error(error) => Err(anyhow!(error.message)),
                    _ => Err(anyhow!("o servidor não confirmou a sessão")),
                };
            }
            Err(error) => last_error = Some(error.to_string()),
        }
        if attempt + 1 < attempts {
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }
    Err(anyhow!(
        "servidor indisponível em {server_url}: {}",
        last_error.unwrap_or_else(|| "falha desconhecida".to_owned())
    ))
}

async fn run_connected(
    socket: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    commands: &mut UnboundedReceiver<ClientEvent>,
    events: &mpsc::Sender<ServerEvent>,
    joined_room: &mut Option<String>,
) -> bool {
    let mut heartbeat = tokio::time::interval(Duration::from_secs(20));
    loop {
        tokio::select! {
            command = commands.recv() => {
                let Some(command) = command else { return true };
                match &command {
                    ClientEvent::VoiceJoin { room_id } => *joined_room = Some(room_id.clone()),
                    ClientEvent::VoiceLeave { room_id }
                        if joined_room.as_deref() == Some(room_id.as_str()) =>
                    {
                        *joined_room = None
                    }
                    _ => {}
                }
                let Ok(payload) = serde_json::to_string(&command) else { continue };
                if socket.send(Message::Text(payload.into())).await.is_err() { return false; }
            }
            incoming = socket.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(event) = serde_json::from_str::<ServerEvent>(&text) {
                            let _ = events.send(event);
                        }
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() { return false; }
                    }
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => return false,
                    _ => {}
                }
            }
            _ = heartbeat.tick() => {
                let heartbeat_event = ClientEvent::Ping {
                    sent_at: "1970-01-01T00:00:00.000Z".to_owned(),
                };
                let Ok(payload) = serde_json::to_string(&heartbeat_event) else { continue };
                if socket.send(Message::Text(payload.into())).await.is_err() { return false; }
            }
        }
    }
}
