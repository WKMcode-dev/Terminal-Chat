use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, BorderType, Borders, List, ListItem, ListState},
};
use unicode_width::UnicodeWidthChar;

use crate::{
    app::{App, Focus, Section},
    chat::{ChatMessage, MessageAuthor},
    settings::GlyphMode,
};

use super::super::theme::Theme;

pub fn render_messages(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    match app.section {
        Section::Conversations => render_conversation(frame, area, app, theme),
        Section::Channels => render_channel(frame, area, app, theme),
        _ => {}
    }
}

fn render_conversation(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let Some(conversation) = app.active_conversation() else { return };
    let typing = if conversation.is_typing {
        format!(" {} digitando...", app.settings.glyph_mode.bullet())
    } else {
        String::new()
    };
    let title = format!(
        " {} {}{} ",
        conversation.contact.display_name, conversation.contact.handle, typing
    );
    render_message_list(
        frame,
        area,
        title,
        &conversation.messages,
        &conversation.contact.display_name,
        app.settings.show_timestamps,
        app.message_selection(conversation.messages.len()),
        app.focus == Focus::Content,
        app.settings.glyph_mode,
        theme,
    );
}

fn render_channel(frame: &mut Frame, area: Rect, app: &App, theme: Theme) {
    let Some(channel) = app.channels.get(app.active_channel) else { return };
    let bullet = app.settings.glyph_mode.bullet();
    let title = format!(
        " #{}  {}  {} online  {}  {} ",
        channel.name, bullet, channel.members_online, bullet, channel.description
    );
    render_message_list(
        frame,
        area,
        title,
        &channel.messages,
        "Contato",
        app.settings.show_timestamps,
        app.message_selection(channel.messages.len()),
        app.focus == Focus::Content,
        app.settings.glyph_mode,
        theme,
    );
}

fn render_message_list(
    frame: &mut Frame,
    area: Rect,
    title: String,
    messages: &[ChatMessage],
    contact_name: &str,
    show_timestamps: bool,
    selected_message: Option<usize>,
    focused: bool,
    glyph_mode: GlyphMode,
    theme: Theme,
) {
    let items: Vec<ListItem> = messages
        .iter()
        .map(|message| {
            message_item(
                message,
                contact_name,
                area.width.saturating_sub(4) as usize,
                show_timestamps,
                theme,
            )
        })
        .collect();
    let list = List::new(items)
        .block(
            Block::default()
                .title(title)
                .title_style(theme.title())
                .title_bottom(match history_hint(focused, glyph_mode) {
                    Some(hint) => hint,
                    None => "",
                })
                .borders(Borders::ALL)
                .border_type(BorderType::Rounded)
                .border_style(theme.border(focused)),
        )
        .highlight_style(Style::default().bg(theme.surface).fg(theme.text))
        .highlight_symbol(glyph_mode.selector());

    let mut state = ListState::default();
    state.select(selected_message);
    frame.render_stateful_widget(list, area, &mut state);
}

fn history_hint(focused: bool, glyph_mode: GlyphMode) -> Option<&'static str> {
    focused.then_some(match glyph_mode {
        GlyphMode::Unicode => {
            " ↑↓ mensagem  •  PgUp/PgDn página  •  Ctrl+C copiar "
        }
        GlyphMode::Ascii => {
            " Up/Down mensagem  |  PgUp/PgDn página  |  Ctrl+C copiar "
        }
    })
}

fn message_item(
    message: &ChatMessage,
    contact_name: &str,
    content_width: usize,
    show_timestamp: bool,
    theme: Theme,
) -> ListItem<'static> {
    let (author, color) = match &message.author {
        MessageAuthor::Me => ("Você".to_owned(), theme.primary),
        MessageAuthor::Contact => (contact_name.to_owned(), theme.secondary),
        MessageAuthor::Named(name) => (name.clone(), theme.secondary),
        MessageAuthor::System => ("Sistema".to_owned(), theme.subtle),
    };

    let mut heading = vec![Span::styled(
        author,
        Style::default().fg(color).add_modifier(Modifier::BOLD),
    )];
    if show_timestamp {
        heading.push(Span::styled(
            format!("  {}", message.sent_at),
            Style::default().fg(theme.subtle),
        ));
    }
    let mut lines = vec![Line::from(heading)];
    lines.extend(
        wrap_body(&message.body, content_width.max(1))
            .into_iter()
            .map(|line| Line::styled(line, Style::default().fg(theme.text))),
    );
    lines.push(Line::raw(""));

    ListItem::new(Text::from(lines))
}

fn wrap_body(body: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    let mut current_width = 0;

    for character in body.chars() {
        let character_width = character.width().unwrap_or(0);
        if character == '\n' || (current_width + character_width > width && !current.is_empty()) {
            lines.push(std::mem::take(&mut current));
            current_width = 0;
            if character == '\n' {
                continue;
            }
        }
        current.push(character);
        current_width += character_width;
    }

    if !current.is_empty() || lines.is_empty() {
        lines.push(current);
    }
    lines
}
