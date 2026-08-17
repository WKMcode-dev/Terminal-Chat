use ratatui::layout::Rect;

pub const MIN_TERMINAL_WIDTH: u16 = 40;
pub const MIN_TERMINAL_HEIGHT: u16 = 14;
const WIDE_LAYOUT_MIN_WIDTH: u16 = 112;
const MEDIUM_LAYOUT_MIN_WIDTH: u16 = 76;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutMode {
    Wide,
    Medium,
    Compact,
    TooSmall,
}

impl LayoutMode {
    pub fn detect(area: Rect, force_compact: bool) -> Self {
        if area.width < MIN_TERMINAL_WIDTH || area.height < MIN_TERMINAL_HEIGHT {
            return Self::TooSmall;
        }
        if force_compact || area.width < MEDIUM_LAYOUT_MIN_WIDTH {
            return Self::Compact;
        }
        if area.width < WIDE_LAYOUT_MIN_WIDTH {
            return Self::Medium;
        }
        Self::Wide
    }

    pub const fn is_compact(self) -> bool {
        matches!(self, Self::Compact)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chooses_a_layout_for_each_supported_width() {
        assert_eq!(
            LayoutMode::detect(Rect::new(0, 0, 120, 30), false),
            LayoutMode::Wide
        );
        assert_eq!(
            LayoutMode::detect(Rect::new(0, 0, 90, 30), false),
            LayoutMode::Medium
        );
        assert_eq!(
            LayoutMode::detect(Rect::new(0, 0, 60, 30), false),
            LayoutMode::Compact
        );
    }

    #[test]
    fn prioritizes_safety_and_the_compact_preference() {
        assert_eq!(
            LayoutMode::detect(Rect::new(0, 0, 30, 30), false),
            LayoutMode::TooSmall
        );
        assert_eq!(
            LayoutMode::detect(Rect::new(0, 0, 120, 30), true),
            LayoutMode::Compact
        );
    }
}
