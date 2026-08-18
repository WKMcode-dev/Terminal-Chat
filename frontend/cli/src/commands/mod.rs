use crate::app::Section;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    Open(Section),
    Help,
    Logout,
    Quit,
}

impl Command {
    pub fn parse(input: &str) -> Option<Self> {
        match input.trim().to_lowercase().as_str() {
            "/conversas" | "/chats" => Some(Self::Open(Section::Conversations)),
            "/canais" => Some(Self::Open(Section::Channels)),
            "/perfil" | "/perfis" => Some(Self::Open(Section::Profiles)),
            "/config" | "/configuracoes" | "/configurações" => {
                Some(Self::Open(Section::Settings))
            }
            "/ajuda" | "/help" => Some(Self::Help),
            "/sair" | "/logout" | "/deslogar" => Some(Self::Logout),
            "/quit" | "/fechar" => Some(Self::Quit),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_portuguese_navigation_commands() {
        assert_eq!(Command::parse("/canais"), Some(Command::Open(Section::Channels)));
        assert_eq!(
            Command::parse("/configurações"),
            Some(Command::Open(Section::Settings))
        );
    }

    #[test]
    fn ignores_regular_messages() {
        assert_eq!(Command::parse("Bora jogar?"), None);
    }

    #[test]
    fn distinguishes_logout_from_closing_the_program() {
        assert_eq!(Command::parse("/sair"), Some(Command::Logout));
        assert_eq!(Command::parse("/quit"), Some(Command::Quit));
    }
}
