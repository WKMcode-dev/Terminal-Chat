use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Paragraph},
};

use crate::app::App;

use super::super::theme::Theme;

pub fn render_voice_status(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let microphone = if app.muted { "MUDO" } else { "ATIVO" };
    let microphone_color = if app.muted { theme.danger } else { theme.success };
    let audio = if app.deafened { "SILENCIADO" } else { "ATIVO" };
    let audio_color = if app.deafened { theme.danger } else { theme.success };

    let status = if app.microphone_test_active {
        " Teste de microfone "
    } else if app.voice_connected {
        " Voz conectada "
    } else {
        " Voz desconectada "
    };
    let mut spans = vec![Span::styled(
        status,
        Style::default().fg(theme.secondary).add_modifier(Modifier::BOLD),
    )];
    if area.width >= 76 && !app.microphone_test_active {
        spans.push(Span::styled(
            format!("{} {} participantes  ", app.settings.glyph_mode.bullet(), app.voice_participants),
            Style::default().fg(theme.subtle),
        ));
    }
    if app.microphone_test_active {
        spans.push(Span::styled(
            "[F9] ENCERRAR  ",
            Style::default().fg(theme.subtle),
        ));
    } else {
        spans.extend([
            Span::styled("[F4] ENTRAR/SAIR  ", Style::default().fg(theme.subtle)),
            Span::styled("[F9] TESTAR  ", Style::default().fg(theme.subtle)),
            Span::styled("[F2] MIC ", Style::default().fg(theme.subtle)),
            Span::styled(microphone, Style::default().fg(microphone_color)),
            Span::styled("  [F3] ÁUDIO ", Style::default().fg(theme.subtle)),
            Span::styled(audio, Style::default().fg(audio_color)),
        ]);
    }
    if app.microphone_test_active || (area.width >= 118 && app.voice_connected) {
        let level = app.voice.microphone_level();
        let active = (level * 8.0).round() as usize;
        let meter = format!("  NÍVEL [{}{}]", "█".repeat(active), "░".repeat(8 - active));
        spans.push(Span::styled(meter, Style::default().fg(if level > 0.7 {
            theme.warning
        } else {
            theme.success
        })));
    }
    let line = Line::from(spans);

    frame.render_widget(
        Paragraph::new(line).block(
            Block::default()
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(theme.border(false)),
        ),
        area,
    );
}
