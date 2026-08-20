use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientEvent {
    #[serde(rename = "auth.login")]
    AuthLogin { username: String, password: String },
    #[serde(rename = "auth.register")]
    AuthRegister {
        #[serde(rename = "displayName")]
        display_name: String,
        username: String,
        password: String,
    },
    #[serde(rename = "auth.resume")]
    AuthResume {
        #[serde(rename = "accessToken")]
        access_token: String,
    },
    #[serde(rename = "message.send")]
    MessageSend {
        #[serde(rename = "clientId")]
        client_id: String,
        scope: MessageScope,
        #[serde(rename = "targetId")]
        target_id: String,
        body: String,
    },
    #[serde(rename = "message.edit")]
    MessageEdit {
        #[serde(rename = "messageId")]
        message_id: String,
        body: String,
    },
    #[serde(rename = "message.delete")]
    MessageDelete {
        #[serde(rename = "messageId")]
        message_id: String,
    },
    #[serde(rename = "presence.update")]
    PresenceUpdate {
        presence: WirePresence,
        activity: String,
    },
    #[serde(rename = "profile.update")]
    ProfileUpdate {
        #[serde(rename = "displayName")]
        display_name: String,
        bio: String,
        avatar: String,
        activity: String,
    },
    #[serde(rename = "friend.request")]
    FriendRequest {
        #[serde(rename = "userId")]
        user_id: String,
    },
    #[serde(rename = "friend.respond")]
    FriendRespond {
        #[serde(rename = "friendshipId")]
        friendship_id: String,
        action: FriendResponse,
    },
    #[serde(rename = "friend.remove")]
    FriendRemove {
        #[serde(rename = "userId")]
        user_id: String,
    },
    #[serde(rename = "friend.block")]
    FriendBlock {
        #[serde(rename = "userId")]
        user_id: String,
    },
    #[serde(rename = "conversation.open")]
    ConversationOpen {
        #[serde(rename = "userId")]
        user_id: String,
    },
    #[serde(rename = "conversation.close")]
    ConversationClose {
        #[serde(rename = "userId")]
        user_id: String,
    },
    #[serde(rename = "account.delete")]
    AccountDelete {
        password: String,
        confirmation: String,
    },
    #[serde(rename = "voice.join")]
    VoiceJoin {
        #[serde(rename = "roomId")]
        room_id: String,
        codec: VoiceCodec,
    },
    #[serde(rename = "voice.leave")]
    VoiceLeave {
        #[serde(rename = "roomId")]
        room_id: String,
    },
    #[serde(rename = "voice.audio")]
    VoiceAudio {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "sampleRate")]
        sample_rate: u32,
        codec: VoiceCodec,
        samples: String,
    },
    #[serde(rename = "ping")]
    Ping {
        #[serde(rename = "sentAt")]
        sent_at: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerEvent {
    #[serde(rename = "session.ready")]
    SessionReady(SessionReady),
    #[serde(rename = "error")]
    Error(WireError),
    #[serde(rename = "message.created")]
    MessageCreated(WireMessage),
    #[serde(rename = "message.updated")]
    MessageUpdated(WireMessage),
    #[serde(rename = "message.deleted")]
    MessageDeleted {
        #[serde(rename = "messageId")]
        message_id: String,
        #[serde(rename = "authorId")]
        author_id: String,
        scope: MessageScope,
        #[serde(rename = "targetId")]
        target_id: String,
    },
    #[serde(rename = "channel.created")]
    ChannelCreated(WireChannel),
    #[serde(rename = "presence.changed")]
    PresenceChanged(WireUser),
    #[serde(rename = "profile.updated")]
    ProfileUpdated(WireUser),
    #[serde(rename = "profile.removed")]
    ProfileRemoved {
        #[serde(rename = "userId")]
        user_id: String,
    },
    #[serde(rename = "account.deleted")]
    AccountDeleted {
        deleted: bool,
        #[serde(rename = "userId")]
        user_id: String,
    },
    #[serde(rename = "friendship.changed")]
    FriendshipChanged(WireFriendship),
    #[serde(rename = "friendship.removed")]
    FriendshipRemoved {
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "otherUserId")]
        other_user_id: String,
    },
    #[serde(rename = "conversation.opened")]
    ConversationOpened(WireConversation),
    #[serde(rename = "conversation.closed")]
    ConversationClosed {
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "contactId")]
        contact_id: String,
    },
    #[serde(rename = "typing.changed")]
    TypingChanged {
        #[serde(rename = "userId")]
        user_id: String,
        scope: MessageScope,
        #[serde(rename = "targetId")]
        target_id: String,
        typing: bool,
    },
    #[serde(rename = "voice.state")]
    VoiceState {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "participantIds")]
        participant_ids: Vec<String>,
    },
    #[serde(rename = "voice.audio")]
    VoiceAudio {
        #[serde(rename = "roomId")]
        room_id: String,
        #[serde(rename = "userId")]
        user_id: String,
        #[serde(rename = "sampleRate")]
        sample_rate: u32,
        #[serde(default)]
        codec: VoiceCodec,
        samples: String,
    },
    #[serde(rename = "pong")]
    Pong {
        #[serde(rename = "sentAt")]
        sent_at: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionReady {
    pub access_token: String,
    pub bootstrap: Bootstrap,
    #[serde(default = "legacy_protocol_version")]
    pub protocol_version: u16,
}

const fn legacy_protocol_version() -> u16 {
    2
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    #[serde(rename = "self")]
    pub current_user: WireUser,
    pub channels: Vec<WireChannel>,
    pub profiles: Vec<WireUser>,
    pub conversations: Vec<WireConversation>,
    pub channel_messages: HashMap<String, Vec<WireMessage>>,
    #[serde(default)]
    pub friendships: Vec<WireFriendship>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireUser {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub presence: WirePresence,
    pub activity: String,
    #[serde(default)]
    pub bio: String,
    #[serde(default)]
    pub avatar: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireFriendship {
    pub id: String,
    pub requester_id: String,
    pub addressee_id: String,
    pub status: WireFriendshipStatus,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireChannel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub members_online: u16,
    pub unread: u16,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireConversation {
    pub contact: WireUser,
    pub unread: u16,
    pub messages: Vec<WireMessage>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireMessage {
    pub id: String,
    pub client_id: Option<String>,
    pub scope: MessageScope,
    pub target_id: String,
    pub author: WireUser,
    pub body: String,
    pub created_at: String,
    pub edited_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WireError {
    pub code: String,
    pub message: String,
    pub request_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageScope {
    Channel,
    Direct,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum VoiceCodec {
    #[default]
    F32,
    Pcm16,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WirePresence {
    Online,
    Away,
    Busy,
    Offline,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FriendResponse {
    Accept,
    Decline,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WireFriendshipStatus {
    Pending,
    Accepted,
    Blocked,
}
