use ratatui::{
    Frame,
    layout::{Constraint, Flex, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Clear, Paragraph, Wrap},
};

use crate::app::{AccountDialog, App};

use super::super::theme::Theme;

pub fn render_account_dialog(frame: &mut Frame, app: &App, theme: Theme) {
    let Some(dialog) = app.account_dialog else {
        return;
    };
    let height = match dialog {
        AccountDialog::Logout => 10,
        AccountDialog::DeleteConfirmation | AccountDialog::DeletePassword => 14,
        AccountDialog::DeletePending => 9,
    };
    let area = centered_rect(frame.area(), 72, height);
    frame.render_widget(Clear, area);

    let (title, lines, cursor) = match dialog {
        AccountDialog::Logout => (
            " Sair e trocar conta ",
            vec![
                Line::raw(""),
                Line::styled(
                    "Sua sessão salva será removida deste computador.",
                    Style::default().fg(theme.text),
                ),
                Line::raw(""),
                Line::styled(
                    "Você voltará à tela de login e poderá entrar ou criar outra conta.",
                    Style::default().fg(theme.subtle),
                ),
                Line::raw(""),
                Line::styled(
                    "Enter / S confirmar   •   Esc / N cancelar",
                    Style::default().fg(theme.primary).add_modifier(Modifier::BOLD),
                ),
            ],
            None,
        ),
        AccountDialog::DeleteConfirmation => {
            let phrase = app.delete_confirmation_phrase();
            let available = area.width.saturating_sub(6) as usize;
            let (visible, cursor) = app.account_input.viewport(available);
            (
                " Excluir conta — confirmação 1 de 2 ",
                vec![
                    Line::styled(
                        "Esta ação apaga permanentemente perfil, amizades e mensagens.",
                        Style::default().fg(theme.danger).add_modifier(Modifier::BOLD),
                    ),
                    Line::raw(""),
                    Line::from(vec![
                        Span::styled("Digite exatamente: ", Style::default().fg(theme.text)),
                        Span::styled(phrase, Style::default().fg(theme.warning)),
                    ]),
                    Line::raw(""),
                    Line::from(vec![
                        Span::styled("> ", Style::default().fg(theme.primary)),
                        Span::styled(visible, Style::default().fg(theme.text)),
                    ]),
                    Line::raw(""),
                    Line::styled(
                        "Enter continuar   •   Esc cancelar",
                        Style::default().fg(theme.subtle),
                    ),
                ],
                Some((area.x + 3 + cursor, area.y + 5)),
            )
        }
        AccountDialog::DeletePassword => {
            let available = area.width.saturating_sub(6) as usize;
            let (visible, cursor) = app.account_input.viewport(available);
            let masked = "•".repeat(visible.chars().count());
            (
                " Excluir conta — confirmação 2 de 2 ",
                vec![
                    Line::styled(
                        "A frase foi confirmada. Informe agora a senha da conta.",
                        Style::default().fg(theme.text),
                    ),
                    Line::raw(""),
                    Line::styled(
                        "A senha não será exibida nem armazenada no terminal.",
                        Style::default().fg(theme.subtle),
                    ),
                    Line::raw(""),
                    Line::from(vec![
                        Span::styled("> ", Style::default().fg(theme.primary)),
                        Span::styled(masked, Style::default().fg(theme.text)),
                    ]),
                    Line::raw(""),
                    Line::styled(
                        "Enter excluir permanentemente   •   Esc cancelar",
                        Style::default().fg(theme.danger),
                    ),
                ],
                Some((area.x + 3 + cursor, area.y + 5)),
            )
        }
        AccountDialog::DeletePending => (
            " Excluindo conta ",
            vec![
                Line::raw(""),
                Line::styled(
                    "Aguarde a confirmação segura do servidor...",
                    Style::default().fg(theme.warning).add_modifier(Modifier::BOLD),
                ),
                Line::raw(""),
                Line::styled(
                    "Não feche o aplicativo durante esta operação.",
                    Style::default().fg(theme.subtle),
                ),
            ],
            None,
        ),
    };

    frame.render_widget(
        Paragraph::new(lines)
            .wrap(Wrap { trim: true })
            .block(
                Block::default()
                    .title(title)
                    .title_style(
                        Style::default()
                            .fg(if dialog == AccountDialog::Logout {
                                theme.warning
                            } else {
                                theme.danger
                            })
                            .add_modifier(Modifier::BOLD),
                    )
                    .borders(Borders::ALL)
                    .border_type(BorderType::Double)
                    .border_style(Style::default().fg(if dialog == AccountDialog::Logout {
                        theme.warning
                    } else {
                        theme.danger
                    }))
                    .style(Style::default().bg(theme.background)),
            ),
        area,
    );
    if let Some(position) = cursor {
        frame.set_cursor_position(position);
    }
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
