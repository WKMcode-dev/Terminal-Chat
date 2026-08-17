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
    pub author_id: String,
    pub author: MessageAuthor,
    pub body: String,
    pub sent_at: String,
}

impl ChatMessage {
    pub fn new(
        author: MessageAuthor,
        body: impl Into<String>,
        sent_at: impl Into<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            author_id: String::new(),
            author,
            body: body.into(),
            sent_at: sent_at.into(),
        }
    }

    pub fn from_server(
        id: impl Into<String>,
        author_id: impl Into<String>,
        author: MessageAuthor,
        body: impl Into<String>,
        sent_at: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            author_id: author_id.into(),
            author,
            body: body.into(),
            sent_at: sent_at.into(),
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
