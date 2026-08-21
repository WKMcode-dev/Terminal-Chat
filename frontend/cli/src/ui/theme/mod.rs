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
            primary: Color::Rgb(217, 115, 13),
            secondary: Color::Rgb(82, 156, 202),
            background: Color::Rgb(17, 17, 17),
            surface: Color::Rgb(43, 43, 43),
            text: Color::Rgb(241, 241, 239),
            subtle: Color::Rgb(155, 154, 151),
            success: Color::Rgb(77, 171, 154),
            warning: Color::Rgb(203, 145, 47),
            danger: Color::Rgb(224, 108, 117),
        }
    }
}

impl Theme {
    pub fn from_settings(settings: &UserSettings) -> Self {
        match settings.theme_index() {
            1 => Self {
                primary: Color::Rgb(82, 156, 202),
                secondary: Color::Rgb(154, 109, 215),
                background: Color::Rgb(25, 25, 25),
                surface: Color::Rgb(45, 45, 45),
                text: Color::Rgb(230, 230, 230),
                subtle: Color::Rgb(150, 150, 150),
                success: Color::Rgb(77, 171, 154),
                warning: Color::Rgb(203, 145, 47),
                danger: Color::Rgb(224, 108, 117),
            },
            2 => Self {
                primary: Color::Rgb(217, 115, 13),
                secondary: Color::Rgb(35, 131, 226),
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
