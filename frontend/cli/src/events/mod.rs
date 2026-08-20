use std::time::Duration;

use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};

use crate::{
    app::{AccountDialog, App, Focus, MessageMovement, Section},
    settings::SettingDirection,
};

pub fn poll_and_handle(app: &mut App) -> Result<()> {
    if event::poll(Duration::from_millis(100))? {
        match event::read()? {
            Event::Key(key)
                if matches!(key.kind, KeyEventKind::Press | KeyEventKind::Repeat) =>
            {
                handle_key(app, key)
            }
            Event::Paste(value)
                if matches!(
                    app.account_dialog,
                    Some(AccountDialog::DeleteConfirmation | AccountDialog::DeletePassword)
                ) =>
            {
                app.account_input.insert_str(&value)
            }
            Event::Paste(value) if app.profile_search_active => {
                app.profile_search.insert_str(&value);
                app.profile_search_changed();
            }
            Event::Paste(value)
                if app.focus == Focus::Composer && app.section.is_messaging() =>
            {
                app.input.insert_str(&value)
            }
            _ => {}
        }
    }
    Ok(())
}

fn handle_key(app: &mut App, key: KeyEvent) {
    let control = key.modifiers.contains(KeyModifiers::CONTROL);
    let alt = key.modifiers.contains(KeyModifiers::ALT);
    let shift = key.modifiers.contains(KeyModifiers::SHIFT);

    if app.account_dialog.is_some() {
        handle_account_dialog_key(app, key);
        return;
    }

    if control && shift && !alt && matches!(key.code, KeyCode::Char('q' | 'Q')) {
        app.selected_setting = crate::settings::UserSettings::ROW_COUNT;
        app.activate_setting();
        return;
    }

    if control && !shift && !alt && matches!(key.code, KeyCode::Char('q' | 'Q')) {
        app.quit();
        return;
    }

    if control && !alt && key.code == KeyCode::Char('c') {
        app.copy_selected_message();
        return;
    }

    let system_emoji_shortcut =
        key.modifiers.contains(KeyModifiers::SUPER) && key.code == KeyCode::Char('.');
    if key.code == KeyCode::F(10)
        || (control && !alt && key.code == KeyCode::Char('e'))
        || system_emoji_shortcut
    {
        app.toggle_emoji_picker();
        return;
    }

    if app.show_emoji_picker {
        match key.code {
            KeyCode::Esc => app.toggle_emoji_picker(),
            KeyCode::Left | KeyCode::Char('h') => app.previous_emoji(),
            KeyCode::Right | KeyCode::Char('l') => app.next_emoji(),
            KeyCode::Up | KeyCode::Char('k') => app.previous_emoji_row(),
            KeyCode::Down | KeyCode::Char('j') => app.next_emoji_row(),
            KeyCode::Enter => app.insert_selected_emoji(),
            _ => {}
        }
        return;
    }

    let profile_search_shortcut =
        app.section == Section::Profiles
            && ((control && !alt && matches!(key.code, KeyCode::Char('f' | 'F')))
                || (!control && !alt && key.code == KeyCode::Char('/')));
    if profile_search_shortcut {
        app.open_profile_search();
        return;
    }

    if app.profile_search_active {
        handle_profile_search_key(app, key);
        return;
    }

    app.notice = None;

    if handle_section_shortcut(app, key) {
        return;
    }

    if control && !alt && matches!(key.code, KeyCode::Left | KeyCode::Right) {
        if key.code == KeyCode::Left {
            app.previous_section();
        } else {
            app.next_section();
        }
        app.return_to_navigation();
        return;
    }

    if control && !alt && matches!(key.code, KeyCode::Tab | KeyCode::BackTab) {
        if key.modifiers.contains(KeyModifiers::SHIFT) || key.code == KeyCode::BackTab {
            app.previous_section();
        } else {
            app.next_section();
        }
        app.return_to_navigation();
        return;
    }

    if !app.show_help && app.section.is_messaging() {
        let movement = match key.code {
            KeyCode::PageUp => Some(MessageMovement::PagePrevious),
            KeyCode::PageDown => Some(MessageMovement::PageNext),
            _ => None,
        };
        if let Some(movement) = movement {
            app.focus = Focus::Content;
            app.move_message_selection(movement);
            return;
        }
    }

    match key.code {
        KeyCode::F(1) => {
            app.show_emoji_picker = false;
            app.show_help = !app.show_help;
        }
        KeyCode::F(2) => app.toggle_mute(),
        KeyCode::F(3) => app.toggle_deafen(),
        KeyCode::F(4) => app.toggle_voice(),
        KeyCode::F(9) => app.toggle_microphone_test(),
        KeyCode::Esc if app.editing_message_id.is_some() => app.cancel_message_edit(),
        KeyCode::Esc if app.show_help => app.show_help = false,
        KeyCode::Esc if !app.input.value().is_empty() => app.input.clear(),
        KeyCode::Esc if app.focus != Focus::Navigation => app.return_to_navigation(),
        KeyCode::Esc => app.quit(),
        KeyCode::BackTab if !app.show_help => app.previous_focus(),
        KeyCode::Tab if !app.show_help && key.modifiers.contains(KeyModifiers::SHIFT) => {
            app.previous_focus()
        }
        KeyCode::Tab if !app.show_help => app.next_focus(),
        _ if app.show_help => {}
        _ => handle_focused_key(app, key),
    }
}

fn handle_focused_key(app: &mut App, key: KeyEvent) {
    match app.focus {
        Focus::Navigation => match key.code {
            KeyCode::Up | KeyCode::Char('k') => app.previous_section(),
            KeyCode::Down | KeyCode::Char('j') => app.next_section(),
            KeyCode::Char('h') => app.previous_section(),
            KeyCode::Char('l') => app.next_section(),
            KeyCode::Enter | KeyCode::Right => app.next_focus(),
            _ => {}
        },
        Focus::List => match key.code {
            KeyCode::Up | KeyCode::Char('k') => app.previous_list_item(),
            KeyCode::Down | KeyCode::Char('j') => app.next_list_item(),
            KeyCode::Enter | KeyCode::Right => app.activate_selected_item(),
            KeyCode::Char('x' | 'X') if app.section == Section::Conversations => {
                app.close_selected_conversation()
            }
            KeyCode::Left => app.return_to_navigation(),
            _ => {}
        },
        Focus::Content => handle_content_key(app, key.code),
        Focus::Composer => match key.code {
            KeyCode::Enter => app.send_message(),
            KeyCode::Backspace => app.input.backspace(),
            KeyCode::Delete => app.input.delete(),
            KeyCode::Left => app.input.move_left(),
            KeyCode::Right => app.input.move_right(),
            KeyCode::Home => app.input.move_home(),
            KeyCode::End => app.input.move_end(),
            KeyCode::Char(character) if accepts_text_input(key.modifiers) => {
                app.input.insert_char(character)
            }
            _ => {}
        },
    }
}

fn handle_content_key(app: &mut App, key_code: KeyCode) {
    match app.section {
        Section::Conversations | Section::Channels => match key_code {
            KeyCode::Up | KeyCode::Char('k') => {
                app.move_message_selection(MessageMovement::Previous)
            }
            KeyCode::Down | KeyCode::Char('j') => {
                app.move_message_selection(MessageMovement::Next)
            }
            KeyCode::Home => app.move_message_selection(MessageMovement::First),
            KeyCode::End => app.move_message_selection(MessageMovement::Last),
            KeyCode::Left => app.focus = Focus::List,
            KeyCode::Enter | KeyCode::Right => app.focus = Focus::Composer,
            KeyCode::Char('e' | 'E') => app.begin_edit_selected_message(),
            KeyCode::Char('d' | 'D') => app.delete_selected_message(),
            KeyCode::Char('x' | 'X') if app.section == Section::Conversations => {
                app.close_selected_conversation()
            }
            _ => {}
        },
        Section::Profiles => match key_code {
            KeyCode::Up | KeyCode::Char('k') => app.previous_list_item(),
            KeyCode::Down | KeyCode::Char('j') => app.next_list_item(),
            KeyCode::Char('a' | 'A') => app.primary_profile_action(),
            KeyCode::Char('r' | 'R') => app.remove_or_decline_profile(),
            KeyCode::Char('b' | 'B') => app.toggle_profile_block(),
            KeyCode::Char('m' | 'M') => app.open_selected_profile_conversation(),
            KeyCode::Left => app.focus = Focus::List,
            _ => {}
        },
        Section::Settings => match key_code {
            KeyCode::Up | KeyCode::Char('k') => app.previous_list_item(),
            KeyCode::Down | KeyCode::Char('j') => app.next_list_item(),
            KeyCode::Left => app.change_setting(SettingDirection::Previous),
            KeyCode::Right => app.change_setting(SettingDirection::Next),
            KeyCode::Enter | KeyCode::Char(' ') => app.activate_setting(),
            _ => {}
        },
    }
}

fn handle_section_shortcut(app: &mut App, key: KeyEvent) -> bool {
    let control = key.modifiers.contains(KeyModifiers::CONTROL);
    let alt = key.modifiers.contains(KeyModifiers::ALT);
    let section_index = match key.code {
        KeyCode::F(value @ 5..=8) if !control && !alt => Some((value - 5) as usize),
        code if app.focus == Focus::Navigation && !control && !alt => number_index(code),
        code if control ^ alt => number_index(code),
        _ => None,
    };
    let Some(section_index) = section_index else {
        return false;
    };

    app.switch_section(Section::ALL[section_index], true);
    true
}

fn number_index(key_code: KeyCode) -> Option<usize> {
    match key_code {
        KeyCode::Char('1') => Some(0),
        KeyCode::Char('2') => Some(1),
        KeyCode::Char('3') => Some(2),
        KeyCode::Char('4') => Some(3),
        _ => None,
    }
}

fn accepts_text_input(modifiers: KeyModifiers) -> bool {
    let control = modifiers.contains(KeyModifiers::CONTROL);
    let alt = modifiers.contains(KeyModifiers::ALT);

    !control || alt
}

fn handle_profile_search_key(app: &mut App, key: KeyEvent) {
    match key.code {
        KeyCode::Esc if !app.profile_search.value().is_empty() => app.clear_profile_search(),
        KeyCode::Esc | KeyCode::Enter => app.close_profile_search(),
        KeyCode::Backspace => {
            app.profile_search.backspace();
            app.profile_search_changed();
        }
        KeyCode::Delete => {
            app.profile_search.delete();
            app.profile_search_changed();
        }
        KeyCode::Left => app.profile_search.move_left(),
        KeyCode::Right => app.profile_search.move_right(),
        KeyCode::Home => app.profile_search.move_home(),
        KeyCode::End => app.profile_search.move_end(),
        KeyCode::Char(character) if accepts_text_input(key.modifiers) => {
            app.profile_search.insert_char(character);
            app.profile_search_changed();
        }
        _ => {}
    }
}

fn handle_account_dialog_key(app: &mut App, key: KeyEvent) {
    match app.account_dialog {
        Some(AccountDialog::Logout) => match key.code {
            KeyCode::Enter | KeyCode::Char('s' | 'S' | 'y' | 'Y') => app.confirm_logout(),
            KeyCode::Esc | KeyCode::Char('n' | 'N') => app.cancel_account_dialog(),
            _ => {}
        },
        Some(AccountDialog::DeleteConfirmation | AccountDialog::DeletePassword) => {
            match key.code {
                KeyCode::Esc => app.cancel_account_dialog(),
                KeyCode::Enter
                    if app.account_dialog == Some(AccountDialog::DeleteConfirmation) =>
                {
                    app.confirm_delete_phrase()
                }
                KeyCode::Enter => app.submit_account_deletion(),
                KeyCode::Backspace => app.account_input.backspace(),
                KeyCode::Delete => app.account_input.delete(),
                KeyCode::Left => app.account_input.move_left(),
                KeyCode::Right => app.account_input.move_right(),
                KeyCode::Home => app.account_input.move_home(),
                KeyCode::End => app.account_input.move_end(),
                KeyCode::Char(character) if accepts_text_input(key.modifiers) => {
                    app.account_input.insert_char(character)
                }
                _ => {}
            }
        }
        Some(AccountDialog::DeletePending) | None => {}
    }
}

#[cfg(test)]
mod tests;
