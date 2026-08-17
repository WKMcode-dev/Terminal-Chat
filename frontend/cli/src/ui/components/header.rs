use ratatui::{
    Frame,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Paragraph},
};

use crate::app::App;

use super::super::theme::Theme;

pub fn render_header(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let context = match app.section {
        crate::app::Section::Conversations => app
            .active_conversation()
            .map(|conversation| conversation.contact.display_name.as_str())
            .unwrap_or("Sem conversa"),
        crate::app::Section::Channels => app
            .channels
            .get(app.active_channel)
            .map(|channel| channel.name.as_str())
            .unwrap_or("Sem canal"),
        crate::app::Section::Profiles => app
            .selected_profile()
            .map(|profile| profile.display_name.as_str())
            .unwrap_or("Sem perfil"),
        crate::app::Section::Settings => "Preferências locais",
    };
    let bullet = app.settings.glyph_mode.bullet();

    let content = if area.width < 78 {
        Line::from(vec![
            Span::styled(" TERMINAL CHAT ", theme.title()),
            Span::styled(
                format!(" | {} | ", app.section.title()),
                Style::default().fg(theme.subtle),
            ),
            Span::styled(context, Style::default().fg(theme.secondary)),
        ])
    } else {
        Line::from(vec![
            Span::styled(" TERMINAL CHAT ", theme.title()),
            Span::styled(" | ", Style::default().fg(theme.subtle)),
            Span::styled(
                format!("{} ", app.username),
                Style::default().fg(theme.text).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                if app.connected { "online" } else { "reconectando" },
                Style::default().fg(if app.connected { theme.success } else { theme.warning }),
            ),
            Span::styled(
                format!("  {bullet}  {}  /  ", app.section.title()),
                Style::default().fg(theme.subtle),
            ),
            Span::styled(context, Style::default().fg(theme.secondary)),
        ])
    };

    let header = Paragraph::new(content)
        .alignment(Alignment::Left)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(theme.border(false)),
        )
        .style(Style::default().bg(theme.background));

    frame.render_widget(header, area);
}
