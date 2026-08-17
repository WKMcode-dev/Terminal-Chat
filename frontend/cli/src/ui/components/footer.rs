use ratatui::{
    Frame,
    layout::{Alignment, Rect},
    style::Style,
    text::{Line, Span},
    widgets::Paragraph,
};

use crate::app::App;

use super::super::theme::Theme;

pub fn render_footer(frame: &mut Frame, area: Rect, app: &App, theme: Theme, compact: bool) {
    let bullet = app.settings.glyph_mode.bullet();
    let area_shortcuts = if app.settings.glyph_mode == crate::settings::GlyphMode::Ascii {
        "1-4 na Navegação / Ctrl+Left-Right áreas"
    } else {
        "1-4 na Navegação / Ctrl+←→ áreas"
    };
    let shortcuts = if let Some(notice) = app.notice.as_deref() {
        notice.to_owned()
    } else if app.section == crate::app::Section::Settings {
        "As preferências são salvas automaticamente".to_owned()
    } else if compact {
        format!(
            "Tab painéis  {bullet}  {area_shortcuts} áreas  {bullet}  F1 ajuda"
        )
    } else if app.section.is_messaging() {
        format!(
            "{area_shortcuts}  {bullet}  PgUp/PgDn histórico  {bullet}  Ctrl+C copiar"
        )
    } else {
        let navigation = if app.settings.glyph_mode == crate::settings::GlyphMode::Ascii {
            "Up/Down navegar"
        } else {
            "↑↓ navegar"
        };
        format!(
            "Tab painéis  {bullet}  {area_shortcuts} áreas  {bullet}  \
             {navigation}  {bullet}  F1 ajuda"
        )
    };

    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            shortcuts,
            Style::default().fg(theme.subtle),
        )))
        .alignment(Alignment::Center),
        area,
    );
}
