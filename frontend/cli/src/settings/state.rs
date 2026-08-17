use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy)]
pub enum SettingDirection {
    Previous,
    Next,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GlyphMode {
    Unicode,
    Ascii,
}

impl Default for GlyphMode {
    fn default() -> Self {
        Self::Unicode
    }
}

impl GlyphMode {
    pub const fn label(self) -> &'static str {
        match self {
            Self::Unicode => "Unicode",
            Self::Ascii => "Simplificado",
        }
    }

    pub const fn selector(self) -> &'static str {
        match self {
            Self::Unicode => "› ",
            Self::Ascii => "> ",
        }
    }

    pub const fn bullet(self) -> &'static str {
        match self {
            Self::Unicode => "•",
            Self::Ascii => "|",
        }
    }

    pub const fn presence_online(self) -> &'static str {
        "●"
    }

    pub const fn presence_offline(self) -> &'static str {
        "○"
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UserSettings {
    pub desktop_notifications: bool,
    pub message_sounds: bool,
    pub show_timestamps: bool,
    pub compact_mode: bool,
    theme_index: usize,
    pub glyph_mode: GlyphMode,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            desktop_notifications: true,
            message_sounds: true,
            show_timestamps: true,
            compact_mode: false,
            theme_index: 0,
            glyph_mode: GlyphMode::default(),
        }
    }
}

impl UserSettings {
    pub const ROW_COUNT: usize = 7;
    const THEMES: [&'static str; 3] = ["Kitsune Night", "Notion Dark", "Notion Light"];

    pub fn row(&self, index: usize) -> (&'static str, String, &'static str) {
        match index {
            0 => (
                "Notificações desktop",
                enabled(self.desktop_notifications),
                "Avisar quando uma mensagem chegar em segundo plano",
            ),
            1 => (
                "Som de mensagens",
                enabled(self.message_sounds),
                "Reproduzir um som curto nas novas mensagens",
            ),
            2 => (
                "Horário das mensagens",
                enabled(self.show_timestamps),
                "Mostrar quando cada mensagem foi enviada",
            ),
            3 => (
                "Forçar modo compacto",
                enabled(self.compact_mode),
                "Exibir somente o painel focado em qualquer largura",
            ),
            4 => (
                "Tema da interface",
                Self::THEMES[self.theme_index].to_owned(),
                "Use esquerda e direita para alternar a aparência",
            ),
            5 => (
                "Símbolos decorativos",
                self.glyph_mode.label().to_owned(),
                "Simplifica seletores e separadores, preservando as bolinhas de status",
            ),
            _ => (
                "Idioma e teclado",
                "Português (Brasil) | UTF-8".to_owned(),
                "Compatível com acentos, AltGr, símbolos e emojis",
            ),
        }
    }

    pub const fn theme_index(&self) -> usize {
        self.theme_index
    }

    pub fn normalize(&mut self) {
        self.theme_index %= Self::THEMES.len();
    }

    pub fn change(&mut self, index: usize, direction: SettingDirection) -> bool {
        match index {
            0 => self.desktop_notifications = !self.desktop_notifications,
            1 => self.message_sounds = !self.message_sounds,
            2 => self.show_timestamps = !self.show_timestamps,
            3 => self.compact_mode = !self.compact_mode,
            4 => {
                self.theme_index = match direction {
                    SettingDirection::Next => (self.theme_index + 1) % Self::THEMES.len(),
                    SettingDirection::Previous => self
                        .theme_index
                        .checked_sub(1)
                        .unwrap_or(Self::THEMES.len() - 1),
                }
            }
            5 => {
                self.glyph_mode = match self.glyph_mode {
                    GlyphMode::Unicode => GlyphMode::Ascii,
                    GlyphMode::Ascii => GlyphMode::Unicode,
                }
            }
            _ => return false,
        }
        true
    }
}

fn enabled(value: bool) -> String {
    if value { "Ativado" } else { "Desativado" }.to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fills_missing_fields_from_older_configurations() {
        let settings: UserSettings = serde_json::from_str(
            r#"{"compact_mode":true,"shortcut_scheme":"function_keys"}"#,
        )
        .unwrap();

        assert!(settings.compact_mode);
        assert_eq!(settings.glyph_mode, GlyphMode::Unicode);
    }

    #[test]
    fn keeps_presence_circles_in_both_visual_modes() {
        assert_eq!(GlyphMode::Unicode.presence_online(), "●");
        assert_eq!(GlyphMode::Ascii.presence_online(), "●");
        assert_eq!(GlyphMode::Unicode.presence_offline(), "○");
        assert_eq!(GlyphMode::Ascii.presence_offline(), "○");
    }
}
