use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, List, ListItem, ListState},
};

use crate::app::{App, Focus};

use super::super::theme::Theme;

pub fn render_channels(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let items = app.channels.iter().map(|channel| {
        let unread = (channel.unread > 0).then(|| format!("  [{}]", channel.unread));
        ListItem::new(vec![
            Line::from(vec![
                Span::styled("# ", Style::default().fg(theme.secondary)),
                Span::styled(
                    channel.name.as_str(),
                    Style::default().fg(theme.text).add_modifier(Modifier::BOLD),
                ),
                Span::styled(unread.unwrap_or_default(), Style::default().fg(theme.primary)),
            ]),
            Line::styled(
                format!("  {} online", channel.members_online),
                Style::default().fg(theme.subtle),
            ),
        ])
    });

    let focused = app.focus == Focus::List;
    let list = List::new(items)
        .block(
            Block::default()
                .title(" Canais ")
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
                .fg(theme.text)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol(app.settings.glyph_mode.selector());

    let mut state = ListState::default();
    state.select(Some(app.selected_channel));
    frame.render_stateful_widget(list, area, &mut state);
}
