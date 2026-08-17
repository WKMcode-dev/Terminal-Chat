use ratatui::{
    Frame,
    layout::{Alignment, Rect},
    style::Style,
    text::{Line, Text},
    widgets::{Block, BorderType, Borders, Paragraph, Wrap},
};

use super::super::{
    layout::{MIN_TERMINAL_HEIGHT, MIN_TERMINAL_WIDTH},
    theme::Theme,
};

pub fn render_terminal_too_small(frame: &mut Frame, area: Rect, theme: Theme) {
    let content = Text::from(vec![
        Line::styled("Terminal pequeno demais para uma exibição segura", theme.title()),
        Line::raw(""),
        Line::styled(
            format!(
                "Tamanho atual: {}x{}  |  mínimo: {}x{}",
                area.width, area.height, MIN_TERMINAL_WIDTH, MIN_TERMINAL_HEIGHT
            ),
            Style::default().fg(theme.text),
        ),
        Line::raw("Aumente a janela; a interface se reorganizará automaticamente."),
    ]);

    frame.render_widget(
        Paragraph::new(content)
            .alignment(Alignment::Center)
            .wrap(Wrap { trim: true })
            .block(
                Block::default()
                    .title(" Terminal Chat ")
                    .borders(Borders::ALL)
                    .border_type(BorderType::Rounded)
                    .border_style(theme.border(true)),
            ),
        area,
    );
}
