use ratatui::{
    Frame,
    layout::{Constraint, Direction, Layout, Rect},
    style::Style,
};

use crate::app::{App, Focus};

use super::super::{
    components::{
        render_channels, render_composer, render_contacts, render_emoji_picker, render_footer, render_header,
        render_help, render_messages, render_navigation, render_profile_details, render_profiles,
        render_settings, render_terminal_too_small, render_voice_status,
    },
    layout::LayoutMode,
    theme::Theme,
};

pub fn render(frame: &mut Frame, app: &App) {
    let theme = Theme::from_settings(&app.settings);
    let area = frame.area();
    frame.render_widget(
        ratatui::widgets::Block::default().style(Style::default().bg(theme.background)),
        area,
    );
    let layout_mode = LayoutMode::detect(area, app.settings.compact_mode);
    if layout_mode == LayoutMode::TooSmall {
        render_terminal_too_small(frame, area, theme);
        return;
    }

    let constraints = if app.section.is_messaging() {
        vec![
            Constraint::Length(3),
            Constraint::Min(6),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(1),
        ]
    } else {
        vec![
            Constraint::Length(3),
            Constraint::Min(6),
            Constraint::Length(3),
            Constraint::Length(1),
        ]
    };
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints(constraints)
        .split(area);
    let header = chunks[0];
    let body = chunks[1];
    let voice = chunks[2];

    render_header(frame, header, app, theme);
    render_body(frame, body, app, theme, layout_mode);
    render_voice_status(frame, voice, app, theme);

    let footer = if app.section.is_messaging() {
        let composer = chunks[3];
        let cursor_position = render_composer(frame, composer, app, theme);
        if !app.show_help {
            if let Some(position) = cursor_position {
                frame.set_cursor_position(position);
            }
        }
        chunks[4]
    } else {
        chunks[3]
    };
    render_footer(frame, footer, app, theme, layout_mode.is_compact());

    if app.show_help {
        render_help(frame, app, theme);
    }
    if app.show_emoji_picker {
        render_emoji_picker(frame, app, theme);
    }
}

fn render_body(frame: &mut Frame, area: Rect, app: &App, theme: Theme, layout_mode: LayoutMode) {
    if layout_mode == LayoutMode::Compact {
        match app.focus {
            Focus::Navigation => render_navigation(frame, area, app, theme),
            Focus::List => render_section_list(frame, area, app, theme),
            Focus::Content | Focus::Composer => render_section_content(frame, area, app, theme),
        }
        return;
    }

    let has_list = !matches!(app.section, crate::app::Section::Settings);
    let (navigation_width, list_width, minimum_content_width) = match layout_mode {
        LayoutMode::Wide => (22, 28, 32),
        LayoutMode::Medium => (18, 24, 26),
        _ => unreachable!("o modo compacto e tamanhos inválidos já foram tratados"),
    };
    if has_list {
        let [navigation, list, content] = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(navigation_width),
                Constraint::Length(list_width),
                Constraint::Min(minimum_content_width),
            ])
            .areas(area);
        render_navigation(frame, navigation, app, theme);
        render_section_list(frame, list, app, theme);
        render_section_content(frame, content, app, theme);
    } else {
        let [navigation, content] = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(navigation_width),
                Constraint::Min(minimum_content_width),
            ])
            .areas(area);
        render_navigation(frame, navigation, app, theme);
        render_section_content(frame, content, app, theme);
    }
}

fn render_section_list(frame: &mut Frame, area: ratatui::layout::Rect, app: &App, theme: Theme) {
    match app.section {
        crate::app::Section::Conversations => render_contacts(frame, area, app, theme),
        crate::app::Section::Channels => render_channels(frame, area, app, theme),
        crate::app::Section::Profiles => render_profiles(frame, area, app, theme),
        crate::app::Section::Settings => render_settings(frame, area, app, theme),
    }
}

fn render_section_content(
    frame: &mut Frame,
    area: ratatui::layout::Rect,
    app: &App,
    theme: Theme,
) {
    match app.section {
        crate::app::Section::Conversations | crate::app::Section::Channels => {
            render_messages(frame, area, app, theme)
        }
        crate::app::Section::Profiles => render_profile_details(frame, area, app, theme),
        crate::app::Section::Settings => render_settings(frame, area, app, theme),
    }
}
