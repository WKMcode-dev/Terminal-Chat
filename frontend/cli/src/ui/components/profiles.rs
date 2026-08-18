use ratatui::{
    Frame,
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, List, ListItem, ListState, Paragraph, Wrap},
};

use crate::{
    app::{App, Focus},
    profiles::ProfileRelationship,
};

use super::{super::theme::Theme, contacts::presence_badge};

pub fn render_profiles(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let [search_area, list_area] = Layout::vertical([
        Constraint::Length(3),
        Constraint::Min(3),
    ])
    .areas(area);
    render_profile_search(frame, search_area, app, theme);

    let visible_indices = app.visible_profile_indices();
    let mut items = visible_indices
        .iter()
        .filter_map(|index| app.profiles.get(*index))
        .map(|profile| {
        let (presence, presence_style) =
            presence_badge(profile.presence, app.settings.glyph_mode, theme);
        let you = if profile.is_current_user { "  você" } else { "" };
        let avatar = if profile.avatar.is_empty() {
            String::new()
        } else {
            format!("{} ", profile.avatar)
        };
        ListItem::new(vec![
            Line::from(vec![
                Span::styled(format!("{presence} {avatar}"), presence_style),
                Span::styled(
                    profile.display_name.as_str(),
                    Style::default().fg(theme.text).add_modifier(Modifier::BOLD),
                ),
                Span::styled(you, Style::default().fg(theme.primary)),
            ]),
            Line::styled(
                format!("  {}", profile.handle),
                Style::default().fg(theme.subtle),
            ),
        ])
    })
        .collect::<Vec<_>>();
    if items.is_empty() {
        items.push(ListItem::new(Line::styled(
            "Nenhum usuário encontrado",
            Style::default().fg(theme.subtle),
        )));
    }

    let focused = app.focus == Focus::List;
    let list = List::new(items)
        .block(
            Block::default()
                .title(format!(" Perfis ({}) ", visible_indices.len()))
                .title_style(if focused {
                    theme.title()
                } else {
                    Style::default().fg(theme.subtle)
                })
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(theme.border(focused)),
        )
        .highlight_style(Style::default().bg(theme.surface).fg(theme.text))
        .highlight_symbol(app.settings.glyph_mode.selector());

    let mut state = ListState::default();
    state.select(
        (!visible_indices.is_empty())
            .then_some(app.selected_profile.min(visible_indices.len().saturating_sub(1))),
    );
    frame.render_stateful_widget(list, list_area, &mut state);
}

fn render_profile_search(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let focused = app.profile_search_active;
    let available_width = area.width.saturating_sub(4) as usize;
    let (visible, cursor) = app.profile_search.viewport(available_width);
    let text = if visible.is_empty() && !focused {
        "Pressione / ou Ctrl+F para buscar".to_owned()
    } else {
        visible
    };
    frame.render_widget(
        Paragraph::new(text)
            .style(Style::default().fg(if focused { theme.text } else { theme.subtle }))
            .block(
                Block::default()
                    .title(" Buscar nome ou @usuário ")
                    .title_style(if focused { theme.title() } else { Style::default().fg(theme.subtle) })
                    .borders(Borders::ALL)
                    .border_type(BorderType::Rounded)
                    .border_style(theme.border(focused)),
            ),
        area,
    );
    if focused {
        frame.set_cursor_position((area.x + 1 + cursor, area.y + 1));
    }
}

pub fn render_profile_details(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let Some(profile) = app.selected_profile() else {
        return;
    };
    let (presence, presence_style) =
        presence_badge(profile.presence, app.settings.glyph_mode, theme);
    let relationship = app.selected_profile_relationship();
    let lines = vec![
        Line::from(vec![
            Span::styled(
                if profile.avatar.is_empty() {
                    profile.display_name.clone()
                } else {
                    format!("{}  {}", profile.avatar, profile.display_name)
                },
                Style::default().fg(theme.primary).add_modifier(Modifier::BOLD),
            ),
            Span::styled(format!("  {}", profile.handle), Style::default().fg(theme.subtle)),
        ]),
        Line::raw(""),
        Line::from(vec![
            Span::styled(format!("{presence} "), presence_style),
            Span::styled(profile.activity.clone(), Style::default().fg(theme.text)),
        ]),
        Line::raw(""),
        field("Função", profile.role.clone(), theme),
        field("Sobre", profile.about.clone(), theme),
        field("Relação", relationship_label(&relationship).to_owned(), theme),
        Line::raw(""),
        Line::styled(
            relationship_actions(&relationship),
            Style::default().fg(theme.subtle),
        ),
    ];

    frame.render_widget(
        Paragraph::new(lines)
            .wrap(Wrap { trim: true })
            .block(
                Block::default()
                    .title(" Detalhes do perfil ")
                    .title_style(theme.title())
                    .borders(Borders::ALL)
                    .border_type(BorderType::Rounded)
                    .border_style(theme.border(false)),
            ),
        area,
    );
}

fn relationship_label(relationship: &ProfileRelationship) -> &'static str {
    match relationship {
        ProfileRelationship::CurrentUser => "Sua conta",
        ProfileRelationship::None => "Ainda não são amigos",
        ProfileRelationship::PendingOutgoing => "Solicitação enviada",
        ProfileRelationship::PendingIncoming { .. } => "Solicitação recebida",
        ProfileRelationship::Friends => "Amigos",
        ProfileRelationship::Blocked => "Bloqueado por você",
        ProfileRelationship::BlockedBy => "Contato indisponível",
    }
}

fn relationship_actions(relationship: &ProfileRelationship) -> &'static str {
    match relationship {
        ProfileRelationship::CurrentUser => "Edite nome, bio, avatar e atividade no desktop.",
        ProfileRelationship::None => "[A] Adicionar  [M] Mensagem  [F4] Chamar  [B] Bloquear",
        ProfileRelationship::PendingOutgoing => "[R] Cancelar solicitação  [M] Mensagem",
        ProfileRelationship::PendingIncoming { .. } => {
            "[A] Aceitar  [R] Recusar  [M] Mensagem  [B] Bloquear"
        }
        ProfileRelationship::Friends => "[M] Mensagem  [F4] Chamar  [R] Remover  [B] Bloquear",
        ProfileRelationship::Blocked => "[B] ou [R] Desbloquear",
        ProfileRelationship::BlockedBy => "Este contato não está disponível.",
    }
}

fn field(label: &'static str, value: String, theme: Theme) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!("{label}: "),
            Style::default().fg(theme.secondary).add_modifier(Modifier::BOLD),
        ),
        Span::styled(value, Style::default().fg(theme.text)),
    ])
}
