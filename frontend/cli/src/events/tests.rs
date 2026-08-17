use super::{accepts_text_input, handle_key, handle_section_shortcut};
use crate::app::{App, Focus, Section};
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
