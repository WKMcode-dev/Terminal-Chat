use crate::chat::{ChatMessage, MessageAuthor};

use super::Channel;

pub fn sample_channels() -> Vec<Channel> {
    vec![
        Channel::new(
            "geral",
            "Conversa livre da equipe",
            8,
            3,
            vec![
                ChatMessage::new(MessageAuthor::System, "Bem-vindo ao canal #geral.", "19:20"),
                ChatMessage::new(
                    MessageAuthor::Named("Naki".to_owned()),
                    "Quem fecha a equipe hoje?",
                    "19:31",
                ),
                ChatMessage::new(
                    MessageAuthor::Named("João".to_owned()),
                    "Eu entro depois das oito.",
                    "19:33",
                ),
            ],
        ),
        Channel::new(
            "valorant",
            "Partidas, treinos e estratégias",
            5,
            0,
            vec![
                ChatMessage::new(
                    MessageAuthor::Named("Cauê".to_owned()),
                    "Treino de mira antes da ranked?",
                    "18:52",
                ),
                ChatMessage::new(MessageAuthor::Me, "Fechado. Entro em dez minutos.", "18:54"),
            ],
        ),
        Channel::new(
            "clips",
            "Clipes, memes e melhores momentos",
            3,
            1,
            vec![ChatMessage::new(
                MessageAuthor::Named("Marina".to_owned()),
                "Mandei aquele clutch de ontem aqui.",
                "17:09",
            )],
        ),
        Channel::new(
            "projetos",
            "Código, ideias e atualizações",
            4,
            0,
            vec![ChatMessage::new(
                MessageAuthor::System,
                "Kenneth criou o projeto Terminal Chat.",
                "Ter",
            )],
        ),
    ]
}
