use super::{accepts_text_input, handle_key, handle_section_shortcut};
use crate::app::{AccountDialog, App, ExitReason, Focus, Section};
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

#[test]
fn accepts_plain_shifted_and_alt_gr_characters() {
    assert!(accepts_text_input(KeyModifiers::NONE));
    assert!(accepts_text_input(KeyModifiers::SHIFT));
    assert!(accepts_text_input(
        KeyModifiers::CONTROL | KeyModifiers::ALT
    ));
}

#[test]
fn reserves_control_only_for_shortcuts() {
    assert!(!accepts_text_input(KeyModifiers::CONTROL));
}

#[test]
fn uses_plain_numbers_in_the_navigation_panel() {
    let mut app = App::default();
    app.focus = Focus::Navigation;

    assert!(handle_section_shortcut(
        &mut app,
        KeyEvent::new(KeyCode::Char('3'), KeyModifiers::NONE)
    ));
    assert_eq!(app.section, Section::Profiles);
}

#[test]
fn keeps_function_keys_as_an_optional_alias() {
    let mut app = App::default();

    assert!(handle_section_shortcut(
        &mut app,
        KeyEvent::new(KeyCode::F(8), KeyModifiers::NONE)
    ));
    assert_eq!(app.section, Section::Settings);
}

#[test]
fn does_not_consume_plain_numbers_in_the_composer() {
    let mut app = App::default();
    app.focus = Focus::Composer;

    assert!(!handle_section_shortcut(
        &mut app,
        KeyEvent::new(KeyCode::Char('2'), KeyModifiers::NONE)
    ));
}

#[test]
fn does_not_treat_alt_gr_as_a_navigation_shortcut() {
    let mut app = App::default();

    assert!(!handle_section_shortcut(
        &mut app,
        KeyEvent::new(
            KeyCode::Char('1'),
            KeyModifiers::CONTROL | KeyModifiers::ALT
        )
    ));
}

#[test]
fn control_c_no_longer_closes_the_application() {
    let mut app = App::default();
    app.switch_section(Section::Profiles, true);

    handle_key(
        &mut app,
        KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL),
    );

    assert!(!app.should_quit());
    assert_eq!(
        app.notice.as_deref(),
        Some("Selecione uma mensagem para copiar")
    );
}

#[test]
fn control_q_is_the_explicit_exit_shortcut() {
    let mut app = App::default();

    handle_key(
        &mut app,
        KeyEvent::new(KeyCode::Char('q'), KeyModifiers::CONTROL),
    );

    assert!(app.should_quit());
}

#[test]
fn control_arrows_switch_areas_globally() {
    let mut app = App::default();

    handle_key(
        &mut app,
        KeyEvent::new(KeyCode::Right, KeyModifiers::CONTROL),
    );

    assert_eq!(app.section, Section::Channels);
    assert_eq!(app.focus, Focus::Navigation);
}

#[test]
fn f9_is_reserved_for_the_local_microphone_test() {
    let mut app = App::default();
    app.voice_connected = true;

    handle_key(&mut app, KeyEvent::new(KeyCode::F(9), KeyModifiers::NONE));

    assert_eq!(
        app.notice.as_deref(),
        Some("Saia da chamada com F4 antes de testar o microfone")
    );
}

#[test]
fn f10_opens_the_emoji_picker_in_the_composer() {
    let mut app = App::default();
    app.focus = Focus::Composer;

    handle_key(&mut app, KeyEvent::new(KeyCode::F(10), KeyModifiers::NONE));

    assert!(app.show_emoji_picker);
    handle_key(&mut app, KeyEvent::new(KeyCode::Right, KeyModifiers::NONE));
    handle_key(&mut app, KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE));

    assert!(!app.show_emoji_picker);
    assert!(!app.input.value().is_empty());
}

#[test]
fn searches_profiles_by_handle_with_unicode_input_support() {
    let mut app = App::default();
    app.switch_section(Section::Profiles, true);

    handle_key(
        &mut app,
        KeyEvent::new(KeyCode::Char('f'), KeyModifiers::CONTROL),
    );
    for character in "@naki".chars() {
        handle_key(
            &mut app,
            KeyEvent::new(KeyCode::Char(character), KeyModifiers::NONE),
        );
    }

    assert!(app.profile_search_active);
    assert_eq!(app.visible_profile_count(), 1);
    assert_eq!(app.selected_profile().map(|profile| profile.handle.as_str()), Some("@naki"));
}

#[test]
fn logout_requires_confirmation_and_returns_to_login() {
    let mut app = App::default();

    handle_key(
        &mut app,
        KeyEvent::new(
            KeyCode::Char('Q'),
            KeyModifiers::CONTROL | KeyModifiers::SHIFT,
        ),
    );
    assert_eq!(app.account_dialog, Some(AccountDialog::Logout));
    assert_eq!(app.exit_reason(), ExitReason::Running);

    handle_key(&mut app, KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE));
    assert_eq!(app.exit_reason(), ExitReason::Logout);
}

#[test]
fn account_deletion_requires_the_exact_confirmation_phrase() {
    let mut app = App::default();
    app.selected_setting = crate::settings::UserSettings::ROW_COUNT + 1;
    app.activate_setting();
    assert_eq!(app.account_dialog, Some(AccountDialog::DeleteConfirmation));

    app.account_input.insert_str("EXCLUIR @outro");
    handle_key(&mut app, KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE));
    assert_eq!(app.account_dialog, Some(AccountDialog::DeleteConfirmation));

    app.account_input.clear();
    app.account_input.insert_str("EXCLUIR @kenneth");
    handle_key(&mut app, KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE));
    assert_eq!(app.account_dialog, Some(AccountDialog::DeletePassword));
}
