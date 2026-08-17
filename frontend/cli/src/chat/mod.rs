mod input;
mod message;
#[cfg(test)]
mod sample_data;

pub use input::InputBuffer;
pub use message::{ChatMessage, Conversation, MessageAuthor};
#[cfg(test)]
pub use sample_data::sample_conversations;
