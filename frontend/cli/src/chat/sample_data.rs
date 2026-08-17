use crate::friends::{Contact, Presence};

use super::{ChatMessage, Conversation, MessageAuthor};

pub fn sample_conversations() -> Vec<Conversation> {
    vec![
        Conversation::new(
            Contact::new("João", "@joao", Presence::Online, "Jogando Valorant", 2),
            vec![
                ChatMessage::new(MessageAuthor::System, "Conversa iniciada com segurança.", "19:36"),
                ChatMessage::new(MessageAuthor::Contact, "Testando o histórico novo por aí?", "19:37"),
                ChatMessage::new(MessageAuthor::Me, "Sim. Agora dá para navegar sem perder o final.", "19:37"),
                ChatMessage::new(MessageAuthor::Contact, "Bora fechar o time hoje?", "19:38"),
                ChatMessage::new(MessageAuthor::Me, "Bora! Estou terminando uma coisa aqui.", "19:39"),
                ChatMessage::new(MessageAuthor::Contact, "Tranquilo. Entro na sala de voz.", "19:40"),
                ChatMessage::new(MessageAuthor::Me, "Vou chamar a Naki e o Cauê também.", "19:41"),
                ChatMessage::new(MessageAuthor::Contact, "Perfeito. Depois manda o código da sala.", "19:42"),
                ChatMessage::new(MessageAuthor::Me, "Mando sim 😄", "19:42"),
            ],
        ),
        Conversation::new(
            Contact::new("Naki", "@naki", Presence::Away, "Ausente há 8 min", 0),
            vec![
                ChatMessage::new(MessageAuthor::Contact, "Tu viu o evento novo?", "18:12"),
                ChatMessage::new(MessageAuthor::Me, "Ainda não, vou olhar depois da partida.", "18:14"),
            ],
        ),
        Conversation::new(
            Contact::new("Cauê", "@caue", Presence::Busy, "Não perturbe", 0),
            vec![ChatMessage::new(
                MessageAuthor::Contact,
                "Me chama quando o projeto estiver rodando.",
                "Ontem",
            )],
        ),
        Conversation::new(
            Contact::new("Marina", "@marina", Presence::Offline, "Offline", 0),
            vec![ChatMessage::new(
                MessageAuthor::Me,
                "Deixei o convite da equipe por aqui.",
                "Seg",
            )],
        ),
    ]
}
