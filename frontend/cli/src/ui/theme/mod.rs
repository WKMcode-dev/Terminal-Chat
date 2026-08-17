use ratatui::style::{Color, Modifier, Style};

use crate::settings::UserSettings;

#[derive(Debug, Clone, Copy)]
pub struct Theme {
    pub primary: Color,
    pub secondary: Color,
    pub background: Color,
    pub surface: Color,
    pub text: Color,
    pub subtle: Color,
    pub success: Color,
    pub warning: Color,
    pub danger: Color,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            primary: Color::Rgb(103, 232, 249),
            secondary: Color::Rgb(192, 132, 252),
            background: Color::Rgb(12, 15, 24),
            surface: Color::Rgb(24, 30, 44),
            text: Color::Rgb(226, 232, 240),
            subtle: Color::Rgb(126, 139, 160),
            success: Color::Rgb(74, 222, 128),
            warning: Color::Rgb(250, 204, 21),
            danger: Color::Rgb(251, 113, 133),
        }
    }
}

impl Theme {
    pub fn from_settings(settings: &UserSettings) -> Self {
        match settings.theme_index() {
            1 => Self {
                primary: Color::Rgb(86, 156, 214),
                secondary: Color::Rgb(197, 134, 192),
                background: Color::Rgb(25, 25, 25),
                surface: Color::Rgb(45, 45, 45),
                text: Color::Rgb(230, 230, 230),
                subtle: Color::Rgb(150, 150, 150),
                success: Color::Rgb(106, 153, 85),
                warning: Color::Rgb(220, 180, 80),
                danger: Color::Rgb(244, 113, 116),
            },
            2 => Self {
                primary: Color::Rgb(35, 131, 226),
                secondary: Color::Rgb(144, 101, 176),
                background: Color::Rgb(247, 246, 243),
                surface: Color::Rgb(233, 233, 231),
                text: Color::Rgb(55, 53, 47),
                subtle: Color::Rgb(120, 119, 116),
                success: Color::Rgb(68, 131, 97),
                warning: Color::Rgb(203, 145, 47),
                danger: Color::Rgb(212, 76, 71),
            },
            _ => Self::default(),
        }
    }

    pub fn border(self, focused: bool) -> Style {
        let color = if focused { self.primary } else { self.surface };
        Style::default().fg(color)
    }

    pub fn title(self) -> Style {
        Style::default()
            .fg(self.primary)
            .add_modifier(Modifier::BOLD)
    }
}
