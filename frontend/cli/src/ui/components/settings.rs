use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, List, ListItem, ListState},
};

use crate::{
    app::{App, Focus},
    settings::UserSettings,
};

use super::super::theme::Theme;

pub fn render_settings(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let mut items = (0..UserSettings::ROW_COUNT).map(|index| {
        let (label, value, description) = app.settings.row(index);
        ListItem::new(vec![
            Line::from(vec![
                Span::styled(
                    label,
                    Style::default().fg(theme.text).add_modifier(Modifier::BOLD),
                ),
                Span::styled("  ", Style::default()),
                Span::styled(value, Style::default().fg(theme.primary)),
            ]),
            Line::styled(format!("  {description}"), Style::default().fg(theme.subtle)),
            Line::raw(""),
        ])
    }).collect::<Vec<_>>();
    items.push(account_item(
        "Sair e trocar conta",
        "Enter",
        "Remove a sessão salva e volta imediatamente à tela de login",
        theme.warning,
        theme,
    ));
    items.push(account_item(
        "Excluir conta",
        "Protegido",
        "Exige a frase de confirmação e sua senha; a exclusão é permanente",
        theme.danger,
        theme,
    ));

    let focused = app.focus == Focus::Content;
    let interaction_hint = match app.settings.glyph_mode {
        crate::settings::GlyphMode::Unicode => {
            " ↑↓ selecionar  •  Enter executar  •  ←→ alterar preferências "
        }
        crate::settings::GlyphMode::Ascii => {
            " Up/Down selecionar  |  Enter executar  |  Left/Right alterar "
        }
    };
    let list = List::new(items)
        .block(
            Block::default()
                .title(" Configurações ")
                .title_style(if focused {
                    theme.title()
                } else {
                    Style::default().fg(theme.subtle)
                })
                .title_bottom(interaction_hint)
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(theme.border(focused)),
        )
        .highlight_style(Style::default().bg(theme.surface).fg(theme.text))
        .highlight_symbol(app.settings.glyph_mode.selector());

    let mut state = ListState::default();
    state.select(Some(app.selected_setting));
    frame.render_stateful_widget(list, area, &mut state);
}

fn account_item(
    label: &'static str,
    value: &'static str,
    description: &'static str,
    value_color: ratatui::style::Color,
    theme: Theme,
) -> ListItem<'static> {
    ListItem::new(vec![
        Line::from(vec![
            Span::styled(
                label,
                Style::default().fg(theme.text).add_modifier(Modifier::BOLD),
            ),
            Span::raw("  "),
            Span::styled(value, Style::default().fg(value_color)),
        ]),
        Line::styled(format!("  {description}"), Style::default().fg(theme.subtle)),
        Line::raw(""),
    ])
}
