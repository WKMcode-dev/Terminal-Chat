use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, List, ListItem, ListState},
};

use crate::{
    app::{App, Focus, Section},
    settings::GlyphMode,
};

use super::super::theme::Theme;

pub fn render_navigation(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let items = Section::ALL.into_iter().enumerate().map(|(index, section)| {
        let icon = match app.settings.glyph_mode {
            GlyphMode::Unicode => section.icon(),
            GlyphMode::Ascii => match section {
                Section::Conversations => "C",
                Section::Channels => "#",
                Section::Profiles => "@",
                Section::Settings => "*",
            },
        };
        ListItem::new(Line::from(vec![
            Span::styled(
                format!("{icon} "),
                Style::default().fg(theme.secondary),
            ),
            Span::styled(
                section.title(),
                Style::default().fg(theme.text).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                format!("  [{}]", index + 1),
                Style::default().fg(theme.subtle),
            ),
        ]))
    });

    let focused = app.focus == Focus::Navigation;
    let list = List::new(items)
        .block(
            Block::default()
                .title(" Navegação ")
                .title_style(if focused {
                    theme.title()
                } else {
                    Style::default().fg(theme.subtle)
                })
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(theme.border(focused)),
        )
        .highlight_style(
            Style::default()
                .bg(theme.surface)
                .fg(theme.primary)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol(app.settings.glyph_mode.selector());

    let mut state = ListState::default();
    state.select(Some(app.section.index()));
    frame.render_stateful_widget(list, area, &mut state);
}
