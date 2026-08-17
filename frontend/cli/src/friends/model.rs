#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Presence {
    Online,
    Away,
    Busy,
    Offline,
}

#[derive(Debug, Clone)]
pub struct Contact {
    pub id: String,
    pub display_name: String,
    pub handle: String,
    pub presence: Presence,
    pub activity: String,
    pub unread: u16,
}

impl Contact {
    pub fn new(
        display_name: impl Into<String>,
        handle: impl Into<String>,
        presence: Presence,
        activity: impl Into<String>,
        unread: u16,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            display_name: display_name.into(),
            handle: handle.into(),
            presence,
            activity: activity.into(),
            unread,
        }
    }

    pub fn with_id(
        id: impl Into<String>,
        display_name: impl Into<String>,
        handle: impl Into<String>,
        presence: Presence,
        activity: impl Into<String>,
        unread: u16,
    ) -> Self {
        Self {
            id: id.into(),
            display_name: display_name.into(),
            handle: handle.into(),
            presence,
            activity: activity.into(),
            unread,
        }
    }
}
