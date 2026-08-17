use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Flex, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Clear, Paragraph, Wrap},
};

use crate::app::App;

use super::super::theme::Theme;

pub fn render_help(frame: &mut Frame, app: &App, theme: Theme) {
    let area = centered_rect(frame.area(), 78, 28);
    let navigation_keys = if app.settings.glyph_mode == crate::settings::GlyphMode::Ascii {
        "Up / Down ou J / K"
    } else {
        "↑ / ↓ ou J / K"
    };
    let lines = vec![
        shortcut("1 / 2 / 3 / 4", "Abre a área quando Navegação está focada", theme),
        shortcut("Ctrl + ← / →", "Alterna globalmente entre as áreas", theme),
        shortcut("H / L", "Alterna áreas dentro do painel Navegação", theme),
        shortcut("Tab / Shift+Tab", "Percorre os painéis da área atual", theme),
        shortcut(navigation_keys, "Navega pelos itens", theme),
        shortcut("PgUp / PgDn", "Percorre o histórico de mensagens", theme),
        shortcut("Home / End", "Vai ao início ou fim do histórico", theme),
        shortcut("Enter", "Abre, envia ou altera o item selecionado", theme),
        shortcut("F2", "Ativa ou silencia o microfone", theme),
        shortcut("F3", "Ativa ou silencia todo o áudio", theme),
        shortcut("F4", "Entra ou sai da voz da conversa/canal", theme),
        shortcut("F9", "Testa o microfone com retorno local", theme),
        shortcut("A / R / B / M", "Ações no perfil selecionado", theme),
        shortcut("Esc", "Fecha, limpa ou retorna à navegação", theme),
        shortcut("Ctrl+C", "Copia a mensagem atualmente selecionada", theme),
        shortcut("Ctrl+Q", "Encerra o Terminal Chat", theme),
        shortcut("F5-F8", "Aliases opcionais para as quatro áreas", theme),
        Line::raw(""),
        Line::styled(
            "Comandos: /conversas  /canais  /perfis  /config  /ajuda  /sair",
            Style::default().fg(theme.secondary),
        ),
        Line::raw(""),
        Line::styled("Pressione F1 ou Esc para fechar.", Style::default().fg(theme.subtle)),
    ];

    frame.render_widget(Clear, area);
    frame.render_widget(
        Paragraph::new(lines)
            .alignment(Alignment::Left)
            .wrap(Wrap { trim: false })
            .block(
                Block::default()
                    .title(" Ajuda e atalhos ")
                    .title_style(theme.title())
                    .borders(Borders::ALL)
                    .border_type(BorderType::Double)
                    .border_style(Style::default().fg(theme.primary))
                    .style(Style::default().bg(theme.background)),
            ),
        area,
    );
}

fn shortcut(
    key: impl Into<String>,
    description: &'static str,
    theme: Theme,
) -> Line<'static> {
    let key = key.into();
    Line::from(vec![
        Span::styled(
            format!("  {key:<18}"),
            Style::default().fg(theme.primary).add_modifier(Modifier::BOLD),
        ),
        Span::styled(description, Style::default().fg(theme.text)),
    ])
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
