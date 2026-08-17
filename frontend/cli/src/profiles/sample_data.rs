use crate::friends::Presence;

use super::Profile;

pub fn sample_profiles() -> Vec<Profile> {
    vec![
        Profile::new(
            "Kenneth Kitsune",
            "@kenneth",
            "Administrador",
            Presence::Online,
            "Desenvolvendo o Terminal Chat",
            "Raposa da tecnologia, jogador e criador de projetos.",
            true,
        ),
        Profile::new(
            "João",
            "@joao",
            "Amigo",
            Presence::Online,
            "Jogando Valorant",
            "Competitivo, mas sempre fecha o time.",
            false,
        ),
        Profile::new(
            "Naki",
            "@naki",
            "Amiga",
            Presence::Away,
            "Ausente há 8 min",
            "Animes, eventos e boas histórias.",
            false,
        ),
        Profile::new(
            "Cauê",
            "@caue",
            "Amigo",
            Presence::Busy,
            "Não perturbe",
            "Treino, estratégia e código.",
            false,
        ),
    ]
}
