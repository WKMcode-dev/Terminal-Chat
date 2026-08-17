use ratatui::{
    Frame,
    layout::Rect,
    style::Style,
    widgets::{Block, BorderType, Borders, Paragraph},
};

use crate::app::{App, Focus, Section};

use super::super::theme::Theme;

pub fn render_composer(
    frame: &mut Frame,
    area: Rect,
    app: &App,
    theme: Theme,
) -> Option<(u16, u16)> {
    if !app.section.is_messaging() {
        return None;
    }

    let focused = app.focus == Focus::Composer;
    let available_width = area.width.saturating_sub(3) as usize;
    let (visible_input, cursor_column) = app.input.viewport(available_width);
    let (content, style) = if visible_input.is_empty() {
        ("Digite uma mensagem...".to_owned(), Style::default().fg(theme.subtle))
    } else {
        (visible_input, Style::default().fg(theme.text))
    };

    let title = match app.section {
        Section::Conversations => app
            .active_conversation()
            .map(|conversation| format!(" Mensagem para {} ", conversation.contact.display_name))
            .unwrap_or_else(|| " Mensagem ".to_owned()),
        Section::Channels => app
            .channels
            .get(app.active_channel)
            .map(|channel| format!(" Mensagem em #{} ", channel.name))
            .unwrap_or_else(|| " Mensagem ".to_owned()),
        _ => " Mensagem ".to_owned(),
    };

    let composer = Paragraph::new(content).style(style).block(
        Block::default()
            .title(title)
            .title_style(if focused { theme.title() } else { Style::default().fg(theme.subtle) })
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(theme.border(focused)),
    );
    frame.render_widget(composer, area);

    focused.then_some((
        area.x.saturating_add(1).saturating_add(cursor_column),
        area.y.saturating_add(1),
    ))
}
