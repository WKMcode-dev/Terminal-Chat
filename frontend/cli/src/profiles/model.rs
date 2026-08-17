use crate::friends::Presence;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProfileRelationship {
    CurrentUser,
    None,
    PendingOutgoing,
    PendingIncoming { friendship_id: String },
    Friends,
    Blocked,
    BlockedBy,
}

#[derive(Debug, Clone)]
pub struct Profile {
    pub id: String,
    pub display_name: String,
    pub handle: String,
    pub avatar: String,
    pub role: String,
    pub presence: Presence,
    pub activity: String,
    pub about: String,
    pub is_current_user: bool,
}

impl Profile {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        display_name: impl Into<String>,
        handle: impl Into<String>,
        role: impl Into<String>,
        presence: Presence,
        activity: impl Into<String>,
        about: impl Into<String>,
        is_current_user: bool,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            display_name: display_name.into(),
            handle: handle.into(),
            avatar: String::new(),
            role: role.into(),
            presence,
            activity: activity.into(),
            about: about.into(),
            is_current_user,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn with_id(
        id: impl Into<String>,
        display_name: impl Into<String>,
        handle: impl Into<String>,
        role: impl Into<String>,
        presence: Presence,
        activity: impl Into<String>,
        about: impl Into<String>,
        is_current_user: bool,
    ) -> Self {
        Self {
            id: id.into(),
            display_name: display_name.into(),
            handle: handle.into(),
            avatar: String::new(),
            role: role.into(),
            presence,
            activity: activity.into(),
            about: about.into(),
            is_current_user,
        }
    }
}
