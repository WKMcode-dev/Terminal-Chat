use super::App;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Section {
    Conversations,
    Channels,
    Profiles,
    Settings,
}

impl Section {
    pub const ALL: [Self; 4] = [
        Self::Conversations,
        Self::Channels,
        Self::Profiles,
        Self::Settings,
    ];

    pub const fn title(self) -> &'static str {
        match self {
            Self::Conversations => "Conversas",
            Self::Channels => "Canais",
            Self::Profiles => "Perfis",
            Self::Settings => "Configurações",
        }
    }

    pub const fn icon(self) -> &'static str {
        match self {
            Self::Conversations => "◆",
            Self::Channels => "#",
            Self::Profiles => "@",
            Self::Settings => "⚙",
        }
    }

    pub const fn index(self) -> usize {
        match self {
            Self::Conversations => 0,
            Self::Channels => 1,
            Self::Profiles => 2,
            Self::Settings => 3,
        }
    }

    pub const fn is_messaging(self) -> bool {
        matches!(self, Self::Conversations | Self::Channels)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    Navigation,
    List,
    Content,
    Composer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageMovement {
    Previous,
    Next,
    PagePrevious,
    PageNext,
    First,
    Last,
}

impl App {
    pub fn switch_section(&mut self, section: Section, enter_section: bool) {
        self.section = section;
        self.reset_message_selection();
        self.focus = if enter_section {
            self.first_content_focus()
        } else {
            Focus::Navigation
        };
    }

    pub fn next_section(&mut self) {
        self.section = Section::ALL[(self.section.index() + 1) % Section::ALL.len()];
        self.reset_message_selection();
    }

    pub fn previous_section(&mut self) {
        let previous = self
            .section
            .index()
            .checked_sub(1)
            .unwrap_or(Section::ALL.len() - 1);
        self.section = Section::ALL[previous];
        self.reset_message_selection();
    }

    pub fn next_focus(&mut self) {
        self.focus = match (self.section, self.focus) {
            (_, Focus::Navigation) => self.first_content_focus(),
            (Section::Conversations | Section::Channels, Focus::List) => Focus::Content,
            (Section::Conversations | Section::Channels, Focus::Content) => Focus::Composer,
            (Section::Conversations | Section::Channels, Focus::Composer) => Focus::Navigation,
            (Section::Profiles, Focus::List) => Focus::Content,
            (Section::Profiles, Focus::Content) => Focus::Navigation,
            (Section::Settings, Focus::Content) => Focus::Navigation,
            _ => Focus::Navigation,
        };
    }

    pub fn previous_focus(&mut self) {
        self.focus = match (self.section, self.focus) {
            (Section::Conversations | Section::Channels, Focus::Navigation) => Focus::Composer,
            (Section::Conversations | Section::Channels, Focus::Composer) => Focus::Content,
            (Section::Conversations | Section::Channels, Focus::Content) => Focus::List,
            (Section::Profiles, Focus::Navigation) => Focus::Content,
            (Section::Profiles, Focus::Content) => Focus::List,
            (Section::Settings, Focus::Navigation) => Focus::Content,
            _ => Focus::Navigation,
        };
    }

    pub fn return_to_navigation(&mut self) {
        self.focus = Focus::Navigation;
    }

    fn first_content_focus(&self) -> Focus {
        match self.section {
            Section::Conversations | Section::Channels | Section::Profiles => Focus::List,
            Section::Settings => Focus::Content,
        }
    }
}
