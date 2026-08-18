use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Flex, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Clear, Paragraph},
};

use crate::{
    app::App,
    chat::{EMOJI_COLUMNS, EMOJIS},
};

use super::super::theme::Theme;

pub fn render_emoji_picker(frame: &mut Frame, app: &App, theme: Theme) {
    let area = centered_rect(frame.area(), 52, 11);
    let mut lines = Vec::new();

    for (row_index, row) in EMOJIS.chunks(EMOJI_COLUMNS).enumerate() {
        let spans = row
            .iter()
            .enumerate()
            .map(|(column_index, (emoji, _))| {
                let index = row_index * EMOJI_COLUMNS + column_index;
                let style = if index == app.selected_emoji {
                    Style::default()
                        .fg(theme.background)
                        .bg(theme.primary)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(theme.text)
                };
                Span::styled(format!("  {emoji}   "), style)
            })
            .collect::<Vec<_>>();
        lines.push(Line::from(spans).alignment(Alignment::Center));
    }

    let selected_name = EMOJIS
        .get(app.selected_emoji)
        .map(|(_, name)| *name)
        .unwrap_or("Emoji");
    lines.push(Line::raw(""));
    lines.push(
        Line::styled(
            format!("{selected_name}  •  setas para navegar  •  Enter para inserir"),
            Style::default().fg(theme.subtle),
        )
        .alignment(Alignment::Center),
    );

    frame.render_widget(Clear, area);
    frame.render_widget(
        Paragraph::new(lines).block(
            Block::default()
                .title(" Emojis — Win+. / F10 / Ctrl+E ")
                .title_style(theme.title())
                .borders(Borders::ALL)
                .border_type(BorderType::Double)
                .border_style(Style::default().fg(theme.primary))
                .style(Style::default().bg(theme.background)),
        ),
        area,
    );
}

fn centered_rect(area: Rect, width: u16, height: u16) -> Rect {
    let [vertical] = Layout::vertical([Constraint::Length(height.min(area.height))])
        .flex(Flex::Center)
        .areas(area);
    let [centered] = Layout::horizontal([Constraint::Length(width.min(area.width))])
        .flex(Flex::Center)
        .areas(vertical);
    centered
}
