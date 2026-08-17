use crate::chat::ChatMessage;

#[derive(Debug, Clone)]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub members_online: u16,
    pub unread: u16,
    pub messages: Vec<ChatMessage>,
}

impl Channel {
    pub fn new(
        name: impl Into<String>,
        description: impl Into<String>,
        members_online: u16,
        unread: u16,
        messages: Vec<ChatMessage>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.into(),
            description: description.into(),
            members_online,
            unread,
            messages,
        }
    }

    pub fn with_id(
        id: impl Into<String>,
        name: impl Into<String>,
        description: impl Into<String>,
        members_online: u16,
        unread: u16,
        messages: Vec<ChatMessage>,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            description: description.into(),
            members_online,
            unread,
            messages,
        }
    }
}
