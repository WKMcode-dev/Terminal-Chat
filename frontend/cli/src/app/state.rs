use crate::{
    channels::Channel,
    chat::{ChatMessage, Conversation, InputBuffer, MessageAuthor},
    friends::{Contact, Presence},
    network::RealtimeClient,
    profiles::Profile,
    protocol::{
        Bootstrap, MessageScope, ServerEvent, SessionReady, WireFriendship, WireMessage,
        WirePresence, WireUser,
    },
    settings::{self, UserSettings},
    voice::VoiceEngine,
};

#[cfg(test)]
use crate::{channels::sample_channels, chat::sample_conversations, profiles::sample_profiles};

use super::{Focus, Section};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountDialog {
    Logout,
    DeleteConfirmation,
    DeletePassword,
    DeletePending,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitReason {
    Running,
    Quit,
    Logout,
}

pub struct App {
    pub self_user_id: String,
    pub account_username: String,
    pub username: String,
    pub section: Section,
    pub focus: Focus,
    pub conversations: Vec<Conversation>,
    pub channels: Vec<Channel>,
    pub profiles: Vec<Profile>,
    pub friendships: Vec<WireFriendship>,
    pub settings: UserSettings,
    pub selected_conversation: usize,
    pub active_conversation: usize,
    pub selected_channel: usize,
    pub active_channel: usize,
    pub selected_profile: usize,
    pub profile_search: InputBuffer,
    pub profile_search_active: bool,
    pub selected_setting: usize,
    pub selected_message: usize,
    pub input: InputBuffer,
    pub muted: bool,
    pub deafened: bool,
    pub show_help: bool,
    pub show_emoji_picker: bool,
    pub selected_emoji: usize,
    pub notice: Option<String>,
    pub account_dialog: Option<AccountDialog>,
    pub account_input: InputBuffer,
    pub connected: bool,
    pub voice_connected: bool,
    pub microphone_test_active: bool,
    pub voice_participants: usize,
    pub voice_room_id: Option<String>,
    pub realtime: Option<RealtimeClient>,
    pub voice: VoiceEngine,
    exit_reason: ExitReason,
}

#[cfg(test)]
impl Default for App {
    fn default() -> Self {
        let conversations = sample_conversations();
        let channels = sample_channels();
        let selected_message = conversations
            .first()
            .and_then(|conversation| conversation.messages.len().checked_sub(1))
            .unwrap_or(0);
        let (settings, notice) = match settings::load() {
            Ok(settings) => (settings, None),
            Err(_) => (
                UserSettings::default(),
                Some("Configuração inválida; usando os valores padrão".to_owned()),
            ),
        };

        Self {
            self_user_id: "00000000-0000-4000-8000-000000000001".to_owned(),
            account_username: "kenneth".to_owned(),
            username: "Kenneth Kitsune".to_owned(),
            section: Section::Conversations,
            focus: Focus::Composer,
            conversations,
            channels,
            profiles: sample_profiles(),
            friendships: Vec::new(),
            settings,
            selected_conversation: 0,
            active_conversation: 0,
            selected_channel: 0,
            active_channel: 0,
            selected_profile: 0,
            profile_search: InputBuffer::default(),
            profile_search_active: false,
            selected_setting: 0,
            selected_message,
            input: InputBuffer::default(),
            muted: false,
            deafened: false,
            show_help: false,
            show_emoji_picker: false,
            selected_emoji: 0,
            notice,
            account_dialog: None,
            account_input: InputBuffer::default(),
            connected: false,
            voice_connected: false,
            microphone_test_active: false,
            voice_participants: 0,
            voice_room_id: None,
            realtime: None,
            voice: VoiceEngine::default(),
            exit_reason: ExitReason::Running,
        }
    }
}

impl App {
    pub fn from_session(session: SessionReady, realtime: RealtimeClient) -> Self {
        let (settings, notice) = match settings::load() {
            Ok(settings) => (settings, Some("Conectado ao Terminal Chat v2.3.0".to_owned())),
            Err(_) => (
                UserSettings::default(),
                Some("Configuração inválida; usando os valores padrão".to_owned()),
            ),
        };
        let mut app = Self {
            self_user_id: session.bootstrap.current_user.id.clone(),
            account_username: session.bootstrap.current_user.username.clone(),
            username: session.bootstrap.current_user.display_name.clone(),
            section: Section::Conversations,
            focus: Focus::Composer,
            conversations: Vec::new(),
            channels: Vec::new(),
            profiles: Vec::new(),
            friendships: Vec::new(),
            settings,
            selected_conversation: 0,
            active_conversation: 0,
            selected_channel: 0,
            active_channel: 0,
            selected_profile: 0,
            profile_search: InputBuffer::default(),
            profile_search_active: false,
            selected_setting: 0,
            selected_message: 0,
            input: InputBuffer::default(),
            muted: false,
            deafened: false,
            show_help: false,
            show_emoji_picker: false,
            selected_emoji: 0,
            notice,
            account_dialog: None,
            account_input: InputBuffer::default(),
            connected: true,
            voice_connected: false,
            microphone_test_active: false,
            voice_participants: 0,
            voice_room_id: None,
            realtime: Some(realtime),
            voice: VoiceEngine::default(),
            exit_reason: ExitReason::Running,
        };
        app.apply_bootstrap(session.bootstrap);
        app
    }

    pub fn poll_realtime(&mut self) {
        loop {
            let event = self.realtime.as_ref().and_then(RealtimeClient::try_receive);
            let Some(event) = event else { break };
            self.apply_server_event(event);
        }
    }

    pub fn should_quit(&self) -> bool {
        self.exit_reason != ExitReason::Running
    }

    pub const fn exit_reason(&self) -> ExitReason {
        self.exit_reason
    }

    pub fn quit(&mut self) {
        if let (Some(realtime), Some(room_id)) = (self.realtime.as_ref(), self.voice_room_id.take()) {
            let _ = realtime.send(crate::protocol::ClientEvent::VoiceLeave { room_id });
        }
        self.voice.stop();
        self.exit_reason = ExitReason::Quit;
    }

    pub fn logout(&mut self) {
        if let (Some(realtime), Some(room_id)) = (self.realtime.as_ref(), self.voice_room_id.take()) {
            let _ = realtime.send(crate::protocol::ClientEvent::VoiceLeave { room_id });
        }
        self.voice.stop();
        self.exit_reason = ExitReason::Logout;
    }

    fn apply_server_event(&mut self, event: ServerEvent) {
        match event {
            ServerEvent::SessionReady(session) => {
                self.connected = true;
                self.apply_bootstrap(session.bootstrap);
                self.notice = Some("Conexão restaurada e histórico sincronizado".to_owned());
            }
            ServerEvent::Error(error) => {
                if matches!(
                    error.code.as_str(),
                    "RECONNECTING" | "CONNECTION_LOST" | "INVALID_SESSION"
                ) {
                    self.connected = false;
                }
                if self.account_dialog == Some(AccountDialog::DeletePending) {
                    self.account_dialog = Some(AccountDialog::DeletePassword);
                }
                self.notice = Some(error.message);
            }
            ServerEvent::MessageCreated(message) => self.insert_server_message(message),
            ServerEvent::ChannelCreated(channel) => {
                if !self.channels.iter().any(|candidate| candidate.id == channel.id) {
                    self.channels.push(Channel::with_id(
                        channel.id,
                        channel.name,
                        channel.description,
                        channel.members_online,
                        channel.unread,
                        Vec::new(),
                    ));
                }
            }
            ServerEvent::PresenceChanged(user) | ServerEvent::ProfileUpdated(user) => {
                self.update_user(user)
            }
            ServerEvent::ProfileRemoved { user_id } => self.remove_user(&user_id),
            ServerEvent::AccountDeleted { deleted, user_id } => {
                if deleted && user_id == self.self_user_id {
                    self.account_dialog = None;
                    self.logout();
                }
            }
            ServerEvent::FriendshipChanged(friendship) => {
                if let Some(existing) = self
                    .friendships
                    .iter_mut()
                    .find(|candidate| candidate.id == friendship.id)
                {
                    *existing = friendship;
                } else {
                    self.friendships.push(friendship);
                }
            }
            ServerEvent::FriendshipRemoved {
                user_id,
                other_user_id,
            } => {
                self.friendships.retain(|friendship| {
                    !((friendship.requester_id == user_id
                        && friendship.addressee_id == other_user_id)
                        || (friendship.requester_id == other_user_id
                            && friendship.addressee_id == user_id))
                });
            }
            ServerEvent::TypingChanged {
                user_id,
                scope,
                target_id,
                typing,
            } => {
                if scope == MessageScope::Direct && target_id == self.self_user_id {
                    if let Some(conversation) = self
                        .conversations
                        .iter_mut()
                        .find(|conversation| conversation.contact.id == user_id)
                    {
                        conversation.is_typing = typing;
                    }
                }
            }
            ServerEvent::VoiceState {
                room_id,
                participant_ids,
            } if self.voice_room_id.as_deref() == Some(room_id.as_str()) => {
                self.voice_participants = participant_ids.len();
            }
            ServerEvent::VoiceAudio {
                room_id,
                user_id,
                sample_rate,
                samples,
            } if self.voice_room_id.as_deref() == Some(room_id.as_str())
                && user_id != self.self_user_id =>
            {
                if let Err(error) = self.voice.queue_base64(&samples, sample_rate) {
                    self.notice = Some(format!("Falha ao reproduzir voz: {error}"));
                }
            }
            ServerEvent::VoiceAudio { .. } | ServerEvent::Pong { .. } => {}
            ServerEvent::VoiceState { .. } => {}
        }
    }

    fn apply_bootstrap(&mut self, mut bootstrap: Bootstrap) {
        self.self_user_id = bootstrap.current_user.id.clone();
        self.account_username = bootstrap.current_user.username.clone();
        self.username = bootstrap.current_user.display_name.clone();
        self.profiles = bootstrap
            .profiles
            .into_iter()
            .map(|user| profile_from_wire(user, &self.self_user_id))
            .collect();
        self.friendships = bootstrap.friendships;
        self.conversations = bootstrap
            .conversations
            .into_iter()
            .map(|conversation| {
                let contact_id = conversation.contact.id.clone();
                Conversation {
                    contact: contact_from_wire(conversation.contact, conversation.unread),
                    messages: conversation
                        .messages
                        .into_iter()
                        .map(|message| message_from_wire(message, &self.self_user_id, Some(&contact_id)))
                        .collect(),
                    is_typing: false,
                }
            })
            .collect();
        self.channels = bootstrap
            .channels
            .into_iter()
            .map(|channel| {
                let messages = bootstrap.channel_messages.remove(&channel.id).unwrap_or_default();
                Channel::with_id(
                    channel.id,
                    channel.name,
                    channel.description,
                    channel.members_online,
                    channel.unread,
                    messages
                        .into_iter()
                        .map(|message| message_from_wire(message, &self.self_user_id, None))
                        .collect(),
                )
            })
            .collect();
        self.selected_conversation = self.selected_conversation.min(self.conversations.len().saturating_sub(1));
        self.active_conversation = self.active_conversation.min(self.conversations.len().saturating_sub(1));
        self.selected_channel = self.selected_channel.min(self.channels.len().saturating_sub(1));
        self.active_channel = self.active_channel.min(self.channels.len().saturating_sub(1));
        self.selected_profile = self
            .selected_profile
            .min(self.visible_profile_count().saturating_sub(1));
        self.reset_message_selection();
    }

    fn insert_server_message(&mut self, message: WireMessage) {
        let exists = self
            .conversations
            .iter()
            .flat_map(|conversation| &conversation.messages)
            .chain(self.channels.iter().flat_map(|channel| &channel.messages))
            .any(|candidate| candidate.id == message.id);
        if exists { return; }

        match message.scope {
            MessageScope::Channel => {
                if let Some(channel) = self.channels.iter_mut().find(|channel| channel.id == message.target_id) {
                    channel.messages.push(message_from_wire(message, &self.self_user_id, None));
                    self.selected_message = channel.messages.len().saturating_sub(1);
                }
            }
            MessageScope::Direct => {
                let contact_id = if message.author.id == self.self_user_id {
                    message.target_id.clone()
                } else {
                    message.author.id.clone()
                };
                if let Some(conversation) = self
                    .conversations
                    .iter_mut()
                    .find(|conversation| conversation.contact.id == contact_id)
                {
                    conversation.messages.push(message_from_wire(
                        message,
                        &self.self_user_id,
                        Some(&contact_id),
                    ));
                    self.selected_message = conversation.messages.len().saturating_sub(1);
                }
            }
        }
    }

    fn update_user(&mut self, user: WireUser) {
        let presence = presence_from_wire(user.presence);
        if !self.profiles.iter().any(|profile| profile.id == user.id) {
            self.profiles.push(profile_from_wire(user.clone(), &self.self_user_id));
        }
        if user.id != self.self_user_id
            && !self
                .conversations
                .iter()
                .any(|conversation| conversation.contact.id == user.id)
        {
            self.conversations.push(Conversation::new(contact_from_wire(user.clone(), 0), Vec::new()));
        }
        if let Some(profile) = self.profiles.iter_mut().find(|profile| profile.id == user.id) {
            profile.display_name = user.display_name.clone();
            profile.handle = format!("@{}", user.username);
            profile.avatar = user.avatar.clone();
            profile.presence = presence;
            profile.activity = user.activity.clone();
            profile.about = if user.bio.is_empty() {
                format!(
                    "Conta criada em {}",
                    user.created_at.get(..10).unwrap_or("data desconhecida")
                )
            } else {
                user.bio.clone()
            };
        }
        if let Some(conversation) = self
            .conversations
            .iter_mut()
            .find(|conversation| conversation.contact.id == user.id)
        {
            conversation.contact.display_name = user.display_name.clone();
            conversation.contact.handle = format!("@{}", user.username);
            conversation.contact.presence = presence;
            conversation.contact.activity = user.activity.clone();
        }
        if user.id == self.self_user_id {
            self.username = user.display_name.clone();
        }
        let online = self
            .profiles
            .iter()
            .filter(|profile| profile.presence != Presence::Offline)
            .count()
            .min(u16::MAX as usize) as u16;
        for channel in &mut self.channels {
            channel.members_online = online;
        }
    }

    fn remove_user(&mut self, user_id: &str) {
        self.profiles.retain(|profile| profile.id != user_id);
        self.conversations
            .retain(|conversation| conversation.contact.id != user_id);
        self.friendships.retain(|friendship| {
            friendship.requester_id != user_id && friendship.addressee_id != user_id
        });
        self.selected_profile = self
            .selected_profile
            .min(self.visible_profile_count().saturating_sub(1));
        self.selected_conversation = self
            .selected_conversation
            .min(self.conversations.len().saturating_sub(1));
        self.active_conversation = self
            .active_conversation
            .min(self.conversations.len().saturating_sub(1));
    }
}

fn contact_from_wire(user: WireUser, unread: u16) -> Contact {
    Contact::with_id(
        user.id,
        user.display_name,
        format!("@{}", user.username),
        presence_from_wire(user.presence),
        user.activity,
        unread,
    )
}

fn profile_from_wire(user: WireUser, self_user_id: &str) -> Profile {
    let is_current_user = user.id == self_user_id;
    let about = if user.bio.is_empty() {
        format!(
            "Conta criada em {}",
            user.created_at.get(..10).unwrap_or("data desconhecida")
        )
    } else {
        user.bio.clone()
    };
    let avatar = user.avatar.clone();
    let mut profile = Profile::with_id(
        user.id,
        user.display_name,
        format!("@{}", user.username),
        if is_current_user { "Sua conta" } else { "Membro" },
        presence_from_wire(user.presence),
        user.activity,
        about,
        is_current_user,
    );
    profile.avatar = avatar;
    profile
}

fn message_from_wire(message: WireMessage, self_user_id: &str, direct_contact_id: Option<&str>) -> ChatMessage {
    let author = if message.author.id == self_user_id {
        MessageAuthor::Me
    } else if direct_contact_id == Some(message.author.id.as_str()) {
        MessageAuthor::Contact
    } else {
        MessageAuthor::Named(message.author.display_name.clone())
    };
    ChatMessage::from_server(
        message.id,
        message.author.id,
        author,
        message.body,
        format_time(&message.created_at),
    )
}

fn presence_from_wire(presence: WirePresence) -> Presence {
    match presence {
        WirePresence::Online => Presence::Online,
        WirePresence::Away => Presence::Away,
        WirePresence::Busy => Presence::Busy,
        WirePresence::Offline => Presence::Offline,
    }
}

fn format_time(timestamp: &str) -> String {
    timestamp.get(11..16).unwrap_or(timestamp).to_owned()
}
