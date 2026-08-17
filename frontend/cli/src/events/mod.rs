use std::time::Duration;

use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};

use crate::{
    app::{App, Focus, MessageMovement, Section},
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

    if control && !alt && key.code == KeyCode::Char('q') {
        app.quit();
        return;
    }

    if control && !alt && key.code == KeyCode::Char('c') {
        app.copy_selected_message();
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
        KeyCode::F(1) => app.show_help = !app.show_help,
        KeyCode::F(2) => app.toggle_mute(),
        KeyCode::F(3) => app.toggle_deafen(),
        KeyCode::F(4) => app.toggle_voice(),
        KeyCode::F(9) => app.toggle_microphone_test(),
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
            KeyCode::Right | KeyCode::Enter | KeyCode::Char(' ') => {
                app.change_setting(SettingDirection::Next)
            }
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

#[cfg(test)]
mod tests;
