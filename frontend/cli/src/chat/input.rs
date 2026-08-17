use unicode_width::UnicodeWidthChar;

#[derive(Debug, Default)]
pub struct InputBuffer {
    value: String,
    cursor: usize,
}

impl InputBuffer {
    pub fn value(&self) -> &str {
        &self.value
    }

    pub fn insert_char(&mut self, character: char) {
        if character.is_control() {
            return;
        }
        self.value.insert(self.cursor, character);
        self.cursor += character.len_utf8();
    }

    pub fn insert_str(&mut self, value: &str) {
        for character in value.chars() {
            match character {
                '\r' | '\n' | '\t' => self.insert_char(' '),
                character if !character.is_control() => self.insert_char(character),
                _ => {}
            }
        }
    }

    pub fn backspace(&mut self) {
        if let Some((index, _)) = self.value[..self.cursor].char_indices().next_back() {
            self.value.remove(index);
            self.cursor = index;
        }
    }

    pub fn delete(&mut self) {
        if self.cursor < self.value.len() {
            self.value.remove(self.cursor);
        }
    }

    pub fn move_left(&mut self) {
        if let Some((index, _)) = self.value[..self.cursor].char_indices().next_back() {
            self.cursor = index;
        }
    }

    pub fn move_right(&mut self) {
        if let Some(character) = self.value[self.cursor..].chars().next() {
            self.cursor += character.len_utf8();
        }
    }

    pub fn move_home(&mut self) {
        self.cursor = 0;
    }

    pub fn move_end(&mut self) {
        self.cursor = self.value.len();
    }

    pub fn clear(&mut self) {
        self.value.clear();
        self.cursor = 0;
    }

    pub fn take_trimmed(&mut self) -> Option<String> {
        let message = std::mem::take(&mut self.value);
        self.cursor = 0;
        let message = message.trim().to_owned();
        (!message.is_empty()).then_some(message)
    }

    pub fn viewport(&self, width: usize) -> (String, u16) {
        let width = width.max(1);
        let before_cursor = &self.value[..self.cursor];
        let mut start = self.cursor;
        let mut cursor_width = 0;

        for (index, character) in before_cursor.char_indices().rev() {
            let character_width = character.width().unwrap_or(0);
            if cursor_width + character_width >= width {
                break;
            }
            cursor_width += character_width;
            start = index;
        }

        let mut end = self.cursor;
        let mut visible_width = cursor_width;
        for (offset, character) in self.value[self.cursor..].char_indices() {
            let character_width = character.width().unwrap_or(0);
            if visible_width + character_width > width {
                break;
            }
            visible_width += character_width;
            end = self.cursor + offset + character.len_utf8();
        }

        (self.value[start..end].to_owned(), cursor_width as u16)
    }
}

#[cfg(test)]
mod tests {
    use super::InputBuffer;

    #[test]
    fn edits_unicode_without_breaking_boundaries() {
        let mut input = InputBuffer::default();
        input.insert_str("Olá");
        input.move_left();
        input.backspace();

        assert_eq!(input.value(), "Oá");
    }

    #[test]
    fn returns_only_non_empty_messages() {
        let mut input = InputBuffer::default();
        input.insert_str("   ");
        assert_eq!(input.take_trimmed(), None);

        input.insert_str("  Bora jogar?  ");
        assert_eq!(input.take_trimmed().as_deref(), Some("Bora jogar?"));
    }

    #[test]
    fn normalizes_multiline_paste() {
        let mut input = InputBuffer::default();
        input.insert_str("uma\nduas\ttrês");

        assert_eq!(input.value(), "uma duas três");
    }

    #[test]
    fn preserves_portuguese_and_symbol_characters() {
        let mut input = InputBuffer::default();
        input.insert_str("Olá, João! Tudo bem? ç ã é ü @ # / \\ 🦊");

        assert_eq!(input.value(), "Olá, João! Tudo bem? ç ã é ü @ # / \\ 🦊");
    }
}
