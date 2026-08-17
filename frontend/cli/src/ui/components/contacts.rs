use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, List, ListItem, ListState},
};

use crate::{
    app::{App, Focus},
    friends::Presence,
    settings::GlyphMode,
};

use super::super::theme::Theme;

pub fn render_contacts(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let items = app.conversations.iter().map(|conversation| {
        let contact = &conversation.contact;
        let (presence, presence_style) =
            presence_badge(contact.presence, app.settings.glyph_mode, theme);
        let unread = (contact.unread > 0).then(|| format!("  [{}]", contact.unread));

        ListItem::new(vec![
            Line::from(vec![
                Span::styled(format!("{presence} "), presence_style),
                Span::styled(
                    contact.display_name.as_str(),
                    Style::default().fg(theme.text).add_modifier(Modifier::BOLD),
                ),
                Span::styled(unread.unwrap_or_default(), Style::default().fg(theme.primary)),
            ]),
            Line::from(vec![
                Span::raw("  "),
                Span::styled(
                    contact.activity.as_str(),
                    Style::default().fg(theme.subtle),
                ),
            ]),
        ])
    });

    let focused = app.focus == Focus::List;
    let list = List::new(items)
        .block(
            Block::default()
                .title(" Conversas ")
                .title_style(if focused { theme.title() } else { Style::default().fg(theme.subtle) })
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(theme.border(focused)),
        )
        .highlight_style(
            Style::default()
                .bg(theme.surface)
                .fg(theme.text)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol(app.settings.glyph_mode.selector());

    let mut state = ListState::default();
    state.select(Some(app.selected_conversation));
    frame.render_stateful_widget(list, area, &mut state);
}

pub(super) fn presence_badge(
    presence: Presence,
    glyph_mode: GlyphMode,
    theme: Theme,
) -> (&'static str, Style) {
    match presence {
        Presence::Online => (
            glyph_mode.presence_online(),
            Style::default().fg(theme.success),
        ),
        Presence::Away => (
            glyph_mode.presence_online(),
            Style::default().fg(theme.warning),
        ),
        Presence::Busy => (
            glyph_mode.presence_online(),
            Style::default().fg(theme.danger),
        ),
        Presence::Offline => (
            glyph_mode.presence_offline(),
            Style::default().fg(theme.subtle),
        ),
    }
}
