use crate::friends::Contact;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageAuthor {
    Me,
    Contact,
    Named(String),
    System,
}

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub id: String,
    pub client_id: Option<String>,
    pub author_id: String,
    pub author: MessageAuthor,
    pub body: String,
    pub sent_at: String,
    pub edited: bool,
    pub pending: bool,
}

impl ChatMessage {
    pub fn new(
        author: MessageAuthor,
        body: impl Into<String>,
        sent_at: impl Into<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            client_id: None,
            author_id: String::new(),
            author,
            body: body.into(),
            sent_at: sent_at.into(),
            edited: false,
            pending: false,
        }
    }

    pub fn from_server(
        id: impl Into<String>,
        client_id: Option<String>,
        author_id: impl Into<String>,
        author: MessageAuthor,
        body: impl Into<String>,
        sent_at: impl Into<String>,
        edited: bool,
    ) -> Self {
        Self {
            id: id.into(),
            client_id,
            author_id: author_id.into(),
            author,
            body: body.into(),
            sent_at: sent_at.into(),
            edited,
            pending: false,
        }
    }

    pub fn pending(
        client_id: String,
        author_id: String,
        body: String,
    ) -> Self {
        Self {
            id: client_id.clone(),
            client_id: Some(client_id),
            author_id,
            author: MessageAuthor::Me,
            body,
            sent_at: "enviando…".to_owned(),
            edited: false,
            pending: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Conversation {
    pub contact: Contact,
    pub messages: Vec<ChatMessage>,
    pub is_typing: bool,
}

impl Conversation {
    pub fn new(contact: Contact, messages: Vec<ChatMessage>) -> Self {
        Self {
            contact,
            messages,
            is_typing: false,
        }
    }
}
