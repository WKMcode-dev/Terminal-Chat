use crate::{
    chat::{ChatMessage, Conversation, EMOJI_COLUMNS, EMOJIS, MessageAuthor},
    commands::Command,
    platform::clipboard,
    profiles::{Profile, ProfileRelationship},
    protocol::{ClientEvent, FriendResponse, MessageScope, WireFriendshipStatus},
    settings::{self, SettingDirection, UserSettings},
};

use super::{AccountDialog, App, Focus, MessageMovement, Section};

impl App {
    pub const SETTINGS_ROW_COUNT: usize = UserSettings::ROW_COUNT + 2;

    pub fn toggle_emoji_picker(&mut self) {
        if !self.section.is_messaging() || self.focus != Focus::Composer {
            self.notice = Some("Abra o campo de mensagem para escolher um emoji".to_owned());
            return;
        }
        self.show_help = false;
        self.show_emoji_picker = !self.show_emoji_picker;
    }

    pub fn previous_emoji(&mut self) {
        self.selected_emoji = self.selected_emoji.checked_sub(1).unwrap_or(EMOJIS.len() - 1);
    }

    pub fn next_emoji(&mut self) {
        self.selected_emoji = (self.selected_emoji + 1) % EMOJIS.len();
    }

    pub fn previous_emoji_row(&mut self) {
        self.selected_emoji = self.selected_emoji.saturating_sub(EMOJI_COLUMNS);
    }

    pub fn next_emoji_row(&mut self) {
        self.selected_emoji = (self.selected_emoji + EMOJI_COLUMNS).min(EMOJIS.len() - 1);
    }

    pub fn insert_selected_emoji(&mut self) {
        if let Some((emoji, _)) = EMOJIS.get(self.selected_emoji) {
            self.input.insert_str(emoji);
        }
        self.show_emoji_picker = false;
        self.focus = Focus::Composer;
    }

    pub fn next_list_item(&mut self) {
        match self.section {
            Section::Conversations => {
                self.selected_conversation =
                    next(self.selected_conversation, self.conversations.len())
            }
            Section::Channels => {
                self.selected_channel = next(self.selected_channel, self.channels.len())
            }
            Section::Profiles => {
                self.selected_profile = next(self.selected_profile, self.visible_profile_count())
            }
            Section::Settings => {
                self.selected_setting = next(self.selected_setting, Self::SETTINGS_ROW_COUNT)
            }
        }
    }

    pub fn previous_list_item(&mut self) {
        match self.section {
            Section::Conversations => {
                self.selected_conversation =
                    previous(self.selected_conversation, self.conversations.len())
            }
            Section::Channels => {
                self.selected_channel = previous(self.selected_channel, self.channels.len())
            }
            Section::Profiles => {
                self.selected_profile = previous(self.selected_profile, self.visible_profile_count())
            }
            Section::Settings => {
                self.selected_setting = previous(self.selected_setting, Self::SETTINGS_ROW_COUNT)
            }
        }
    }

    pub fn activate_selected_item(&mut self) {
        match self.section {
            Section::Conversations => {
                if let Some(conversation) = self.conversations.get_mut(self.selected_conversation) {
                    conversation.contact.unread = 0;
                    self.active_conversation = self.selected_conversation;
                    self.reset_message_selection();
                    self.focus = Focus::Composer;
                }
            }
            Section::Channels => {
                if let Some(channel) = self.channels.get_mut(self.selected_channel) {
                    channel.unread = 0;
                    self.active_channel = self.selected_channel;
                    self.reset_message_selection();
                    self.focus = Focus::Composer;
                }
            }
            Section::Profiles => self.focus = Focus::Content,
            Section::Settings => self.activate_setting(),
        }
    }

    pub fn active_conversation(&self) -> Option<&Conversation> {
        self.conversations.get(self.active_conversation)
    }

    pub fn selected_profile(&self) -> Option<&Profile> {
        self.visible_profile_indices()
            .get(self.selected_profile)
            .and_then(|index| self.profiles.get(*index))
    }

    pub fn visible_profile_indices(&self) -> Vec<usize> {
        let query = self
            .profile_search
            .value()
            .trim()
            .trim_start_matches('@')
            .to_lowercase();
        self.profiles
            .iter()
            .enumerate()
            .filter_map(|(index, profile)| {
                let matches = query.is_empty()
                    || profile.display_name.to_lowercase().contains(&query)
                    || profile
                        .handle
                        .trim_start_matches('@')
                        .to_lowercase()
                        .contains(&query);
                matches.then_some(index)
            })
            .collect()
    }

    pub fn visible_profile_count(&self) -> usize {
        self.visible_profile_indices().len()
    }

    pub fn open_profile_search(&mut self) {
        self.switch_section(Section::Profiles, true);
        self.show_help = false;
        self.profile_search_active = true;
        self.selected_profile = 0;
        self.notice = Some("Digite um nome ou @usuário; a lista é filtrada em tempo real".to_owned());
    }

    pub fn close_profile_search(&mut self) {
        self.profile_search_active = false;
        self.focus = Focus::List;
    }

    pub fn clear_profile_search(&mut self) {
        self.profile_search.clear();
        self.selected_profile = 0;
    }

    pub fn profile_search_changed(&mut self) {
        self.selected_profile = 0;
    }

    pub fn selected_profile_relationship(&self) -> ProfileRelationship {
        let Some(profile) = self.selected_profile() else {
            return ProfileRelationship::None;
        };
        if profile.is_current_user {
            return ProfileRelationship::CurrentUser;
        }
        let Some(friendship) = self.friendships.iter().find(|friendship| {
            (friendship.requester_id == self.self_user_id
                && friendship.addressee_id == profile.id)
                || (friendship.requester_id == profile.id
                    && friendship.addressee_id == self.self_user_id)
        }) else {
            return ProfileRelationship::None;
        };
        match friendship.status {
            WireFriendshipStatus::Accepted => ProfileRelationship::Friends,
            WireFriendshipStatus::Blocked if friendship.requester_id == self.self_user_id => {
                ProfileRelationship::Blocked
            }
            WireFriendshipStatus::Blocked => ProfileRelationship::BlockedBy,
            WireFriendshipStatus::Pending if friendship.requester_id == self.self_user_id => {
                ProfileRelationship::PendingOutgoing
            }
            WireFriendshipStatus::Pending => ProfileRelationship::PendingIncoming {
                friendship_id: friendship.id.clone(),
            },
        }
    }

    pub fn primary_profile_action(&mut self) {
        let Some(user_id) = self.selected_profile().map(|profile| profile.id.clone()) else {
            return;
        };
        let event = match self.selected_profile_relationship() {
            ProfileRelationship::None => ClientEvent::FriendRequest { user_id },
            ProfileRelationship::PendingIncoming { friendship_id } => {
                ClientEvent::FriendRespond {
                    friendship_id,
                    action: FriendResponse::Accept,
                }
            }
            ProfileRelationship::CurrentUser => {
                self.notice = Some("Edite seu perfil pelo painel desktop".to_owned());
                return;
            }
            ProfileRelationship::PendingOutgoing => {
                self.notice = Some("A solicitação de amizade ainda está pendente".to_owned());
                return;
            }
            ProfileRelationship::Friends => {
                self.open_selected_profile_conversation();
                return;
            }
            ProfileRelationship::Blocked | ProfileRelationship::BlockedBy => {
                self.notice = Some("Esse perfil está bloqueado".to_owned());
                return;
            }
        };
        self.send_profile_event(event, "Solicitação social enviada");
    }

    pub fn remove_or_decline_profile(&mut self) {
        let Some(user_id) = self.selected_profile().map(|profile| profile.id.clone()) else {
            return;
        };
        let event = match self.selected_profile_relationship() {
            ProfileRelationship::PendingIncoming { friendship_id } => {
                ClientEvent::FriendRespond {
                    friendship_id,
                    action: FriendResponse::Decline,
                }
            }
            ProfileRelationship::PendingOutgoing
            | ProfileRelationship::Friends
            | ProfileRelationship::Blocked => ClientEvent::FriendRemove { user_id },
            ProfileRelationship::None => {
                self.notice = Some("Não existe amizade ou solicitação para remover".to_owned());
                return;
            }
            ProfileRelationship::CurrentUser | ProfileRelationship::BlockedBy => {
                self.notice = Some("Essa ação não está disponível para o perfil".to_owned());
                return;
            }
        };
        self.send_profile_event(event, "Ação de amizade enviada");
    }

    pub fn toggle_profile_block(&mut self) {
        let Some(user_id) = self.selected_profile().map(|profile| profile.id.clone()) else {
            return;
        };
        let event = match self.selected_profile_relationship() {
            ProfileRelationship::CurrentUser => {
                self.notice = Some("Você não pode bloquear a própria conta".to_owned());
                return;
            }
            ProfileRelationship::Blocked => ClientEvent::FriendRemove { user_id },
            ProfileRelationship::BlockedBy => {
                self.notice = Some("Esse usuário bloqueou o contato".to_owned());
                return;
            }
            _ => ClientEvent::FriendBlock { user_id },
        };
        self.send_profile_event(event, "Configuração de bloqueio enviada");
    }

    pub fn open_selected_profile_conversation(&mut self) {
        if matches!(
            self.selected_profile_relationship(),
            ProfileRelationship::CurrentUser
                | ProfileRelationship::Blocked
                | ProfileRelationship::BlockedBy
        ) {
            self.notice = Some("Não é possível abrir essa conversa".to_owned());
            return;
        }
        let Some(user_id) = self.selected_profile().map(|profile| profile.id.clone()) else {
            return;
        };
        let Some(index) = self
            .conversations
            .iter()
            .position(|conversation| conversation.contact.id == user_id)
        else {
            self.notice = Some("A conversa ainda não está disponível".to_owned());
            return;
        };
        self.section = Section::Conversations;
        self.selected_conversation = index;
        self.active_conversation = index;
        self.focus = Focus::Composer;
        self.reset_message_selection();
    }

    fn send_profile_event(&mut self, event: ClientEvent, success: &str) {
        self.notice = Some(match self.realtime.as_ref() {
            Some(realtime) => match realtime.send(event) {
                Ok(()) => success.to_owned(),
                Err(error) => format!("Não foi possível concluir a ação: {error}"),
            },
            None => "A ação requer conexão com o servidor".to_owned(),
        });
    }

    pub fn send_message(&mut self) {
        let Some(message) = self.input.take_trimmed() else {
            return;
        };
        if let Some(command) = Command::parse(&message) {
            self.execute_command(command);
            return;
        }
        if let Some(realtime) = self.realtime.as_ref() {
            let target = match self.section {
                Section::Conversations => self
                    .conversations
                    .get(self.active_conversation)
                    .map(|conversation| (MessageScope::Direct, conversation.contact.id.clone())),
                Section::Channels => self
                    .channels
                    .get(self.active_channel)
                    .map(|channel| (MessageScope::Channel, channel.id.clone())),
                _ => None,
            };
            let Some((scope, target_id)) = target else { return };
            self.notice = match realtime.send(ClientEvent::MessageSend {
                client_id: uuid::Uuid::new_v4().to_string(),
                scope,
                target_id,
                body: message,
            }) {
                Ok(()) => None,
                Err(error) => Some(format!("Não foi possível enviar: {error}")),
            };
            return;
        }

        let message = ChatMessage::new(MessageAuthor::Me, message, "agora");

        match self.section {
            Section::Conversations => {
                if let Some(conversation) = self.conversations.get_mut(self.active_conversation) {
                    conversation.messages.push(message);
                    self.selected_message = conversation.messages.len().saturating_sub(1);
                }
            }
            Section::Channels => {
                if let Some(channel) = self.channels.get_mut(self.active_channel) {
                    channel.messages.push(message);
                    self.selected_message = channel.messages.len().saturating_sub(1);
                }
            }
            _ => {}
        }
    }

    pub fn change_setting(&mut self, direction: SettingDirection) {
        if self.selected_setting >= UserSettings::ROW_COUNT {
            return;
        }
        if !self.settings.change(self.selected_setting, direction) {
            return;
        }

        self.notice = Some(match settings::save(&self.settings) {
            Ok(()) => "Preferências salvas automaticamente".to_owned(),
            Err(_) => "Não foi possível salvar as preferências".to_owned(),
        });
    }

    pub fn activate_setting(&mut self) {
        match self.selected_setting {
            index if index < UserSettings::ROW_COUNT => {
                self.change_setting(SettingDirection::Next)
            }
            index if index == UserSettings::ROW_COUNT => {
                self.account_input.clear();
                self.account_dialog = Some(AccountDialog::Logout);
            }
            _ => {
                self.account_input.clear();
                self.account_dialog = Some(AccountDialog::DeleteConfirmation);
            }
        }
    }

    pub fn delete_confirmation_phrase(&self) -> String {
        format!("EXCLUIR @{}", self.account_username)
    }

    pub fn cancel_account_dialog(&mut self) {
        if self.account_dialog == Some(AccountDialog::DeletePending) {
            return;
        }
        self.account_dialog = None;
        self.account_input.clear();
        self.notice = Some("Ação cancelada; nenhum dado foi alterado".to_owned());
    }

    pub fn confirm_logout(&mut self) {
        self.account_dialog = None;
        self.account_input.clear();
        self.logout();
    }

    pub fn confirm_delete_phrase(&mut self) {
        if self.account_input.value().trim() != self.delete_confirmation_phrase() {
            self.notice = Some("A frase de confirmação não corresponde ao solicitado".to_owned());
            return;
        }
        self.account_input.clear();
        self.account_dialog = Some(AccountDialog::DeletePassword);
        self.notice = Some("Agora informe sua senha para confirmar a exclusão".to_owned());
    }

    pub fn submit_account_deletion(&mut self) {
        let password = self.account_input.value().to_owned();
        if password.len() < 8 {
            self.notice = Some("A senha precisa ter pelo menos 8 caracteres".to_owned());
            return;
        }
        self.account_input.clear();
        let event = ClientEvent::AccountDelete {
            password,
            confirmation: self.account_username.clone(),
        };
        self.notice = Some(match self.realtime.as_ref() {
            Some(realtime) => match realtime.send(event) {
                Ok(()) => {
                    self.account_dialog = Some(AccountDialog::DeletePending);
                    "Excluindo a conta com segurança...".to_owned()
                }
                Err(error) => format!("Não foi possível solicitar a exclusão: {error}"),
            },
            None => "A exclusão requer conexão com o servidor".to_owned(),
        });
    }

    pub fn message_selection(&self, message_count: usize) -> Option<usize> {
        message_count
            .checked_sub(1)
            .map(|last| self.selected_message.min(last))
    }

    pub fn reset_message_selection(&mut self) {
        self.selected_message = self.active_message_count().saturating_sub(1);
    }

    pub fn move_message_selection(&mut self, movement: MessageMovement) {
        let message_count = self.active_message_count();
        let Some(last) = message_count.checked_sub(1) else {
            self.selected_message = 0;
            return;
        };
        let selected = self.selected_message.min(last);

        self.selected_message = match movement {
            MessageMovement::Previous => selected.saturating_sub(1),
            MessageMovement::Next => (selected + 1).min(last),
            MessageMovement::PagePrevious => selected.saturating_sub(5),
            MessageMovement::PageNext => (selected + 5).min(last),
            MessageMovement::First => 0,
            MessageMovement::Last => last,
        };
    }

    pub fn copy_selected_message(&mut self) {
        let Some(message) = self.selected_message_text().map(str::to_owned) else {
            self.notice = Some("Selecione uma mensagem para copiar".to_owned());
            return;
        };

        self.notice = Some(match clipboard::copy_text(&message) {
            Ok(()) => "Mensagem copiada para a área de transferência".to_owned(),
            Err(_) => "Não foi possível copiar a mensagem neste terminal".to_owned(),
        });
    }

    pub fn toggle_mute(&mut self) {
        self.muted = !self.muted;
        self.voice.set_muted(self.muted);
    }

    pub fn toggle_deafen(&mut self) {
        self.deafened = !self.deafened;
        if self.deafened {
            self.muted = true;
        }
        self.voice.set_deafened(self.deafened);
        self.voice.set_muted(self.muted);
    }

    pub fn toggle_voice(&mut self) {
        if self.microphone_test_active {
            self.notice = Some("Encerre o teste do microfone com F9 antes de entrar na voz".to_owned());
            return;
        }
        if self.voice_connected {
            if let (Some(realtime), Some(room_id)) = (self.realtime.as_ref(), self.voice_room_id.take()) {
                let _ = realtime.send(ClientEvent::VoiceLeave { room_id });
            }
            self.voice.stop();
            self.voice_connected = false;
            self.voice_participants = 0;
            self.notice = Some("Você saiu da sala de voz".to_owned());
            return;
        }

        let Some(room_id) = self.current_voice_room() else {
            self.notice = Some("Abra uma conversa ou canal para entrar na voz".to_owned());
            return;
        };
        let Some(realtime) = self.realtime.as_ref() else {
            self.notice = Some("A voz requer conexão com o servidor".to_owned());
            return;
        };
        match self.voice.start(room_id.clone(), realtime.sender()) {
            Ok(()) => {
                if let Err(error) = realtime.send(ClientEvent::VoiceJoin { room_id: room_id.clone() }) {
                    self.voice.stop();
                    self.notice = Some(format!("Não foi possível entrar na voz: {error}"));
                    return;
                }
                self.voice_connected = true;
                self.voice_room_id = Some(room_id);
                self.notice = Some("Conectado à sala de voz".to_owned());
            }
            Err(error) => self.notice = Some(format!("Não foi possível iniciar o áudio: {error}")),
        }
    }

    pub fn toggle_microphone_test(&mut self) {
        if self.microphone_test_active {
            self.voice.stop();
            self.microphone_test_active = false;
            self.notice = Some("Teste do microfone encerrado".to_owned());
            return;
        }
        if self.voice_connected {
            self.notice = Some("Saia da chamada com F4 antes de testar o microfone".to_owned());
            return;
        }
        match self.voice.start_test() {
            Ok(()) => {
                self.microphone_test_active = true;
                self.notice = Some(
                    "Teste local ativo: fale e escute o retorno; use fones para evitar eco"
                        .to_owned(),
                );
            }
            Err(error) => {
                self.notice = Some(format!("Não foi possível testar o microfone: {error}"));
            }
        }
    }

    fn execute_command(&mut self, command: Command) {
        match command {
            Command::Open(section) => self.switch_section(section, true),
            Command::Help => self.show_help = true,
            Command::Logout => {
                self.account_input.clear();
                self.account_dialog = Some(AccountDialog::Logout);
            }
            Command::Quit => self.quit(),
        }
    }

    fn active_message_count(&self) -> usize {
        match self.section {
            Section::Conversations => self
                .conversations
                .get(self.active_conversation)
                .map(|conversation| conversation.messages.len())
                .unwrap_or(0),
            Section::Channels => self
                .channels
                .get(self.active_channel)
                .map(|channel| channel.messages.len())
                .unwrap_or(0),
            _ => 0,
        }
    }

    fn selected_message_text(&self) -> Option<&str> {
        let selected = self.message_selection(self.active_message_count())?;
        match self.section {
            Section::Conversations => self
                .conversations
                .get(self.active_conversation)?
                .messages
                .get(selected)
                .map(|message| message.body.as_str()),
            Section::Channels => self
                .channels
                .get(self.active_channel)?
                .messages
                .get(selected)
                .map(|message| message.body.as_str()),
            _ => None,
        }
    }

    fn current_voice_room(&self) -> Option<String> {
        match self.section {
            Section::Channels => self
                .channels
                .get(self.active_channel)
                .map(|channel| format!("channel:{}", channel.id)),
            Section::Conversations => self
                .conversations
                .get(self.active_conversation)
                .map(|conversation| {
                    let mut ids = [self.self_user_id.as_str(), conversation.contact.id.as_str()];
                    ids.sort_unstable();
                    format!("direct:{}:{}", ids[0], ids[1])
                }),
            Section::Profiles => self.selected_profile().and_then(|profile| {
                if profile.is_current_user
                    || matches!(
                        self.selected_profile_relationship(),
                        ProfileRelationship::Blocked | ProfileRelationship::BlockedBy
                    )
                {
                    return None;
                }
                let mut ids = [self.self_user_id.as_str(), profile.id.as_str()];
                ids.sort_unstable();
                Some(format!("direct:{}:{}", ids[0], ids[1]))
            }),
            _ => None,
        }
    }
}

fn next(index: usize, len: usize) -> usize {
    if len == 0 { 0 } else { (index + 1) % len }
}

fn previous(index: usize, len: usize) -> usize {
    if len == 0 {
        0
    } else {
        index.checked_sub(1).unwrap_or(len - 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_messages_to_the_active_channel() {
        let mut app = App::default();
        app.switch_section(Section::Channels, true);
        let initial_count = app.channels[0].messages.len();
        app.input.insert_str("Mensagem no canal");
        app.send_message();

        assert_eq!(app.channels[0].messages.len(), initial_count + 1);
    }

    #[test]
    fn navigation_wraps_around() {
        let mut app = App::default();
        app.previous_list_item();
        assert_eq!(app.selected_conversation, app.conversations.len() - 1);
    }

    #[test]
    fn message_history_navigation_is_bounded() {
        let mut app = App::default();
        app.move_message_selection(MessageMovement::First);
        app.move_message_selection(MessageMovement::Previous);
        assert_eq!(app.selected_message, 0);

        app.move_message_selection(MessageMovement::Last);
        assert_eq!(
            app.selected_message,
            app.conversations[app.active_conversation].messages.len() - 1
        );
    }
}
