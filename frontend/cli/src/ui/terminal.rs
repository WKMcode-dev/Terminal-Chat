use std::io::{Stdout, stdout};

use anyhow::Result;
use crossterm::{
    event::{DisableBracketedPaste, EnableBracketedPaste},
    execute,
    terminal::{
        EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode,
    },
};
use ratatui::{Terminal, backend::CrosstermBackend};

use crate::{app::{App, ExitReason}, events};

type AppTerminal = Terminal<CrosstermBackend<Stdout>>;

pub fn run(mut app: App) -> Result<ExitReason> {
    let mut session = TerminalSession::start()?;

    while !app.should_quit() {
        app.poll_realtime();
        session.terminal.draw(|frame| super::render(frame, &app))?;
        events::poll_and_handle(&mut app)?;
    }

    let exit_reason = app.exit_reason();
    session.restore()?;
    Ok(exit_reason)
}

struct TerminalSession {
    terminal: AppTerminal,
    paste_enabled: bool,
    restored: bool,
}

impl TerminalSession {
    fn start() -> Result<Self> {
        enable_raw_mode()?;
        let mut output = stdout();

        if let Err(error) = execute!(output, EnterAlternateScreen) {
            let _ = disable_raw_mode();
            return Err(error.into());
        }
        let paste_enabled = execute!(output, EnableBracketedPaste).is_ok();

        let terminal = match Terminal::new(CrosstermBackend::new(output)) {
            Ok(terminal) => terminal,
            Err(error) => {
                let _ = disable_raw_mode();
                if paste_enabled {
                    let _ = execute!(stdout(), DisableBracketedPaste);
                }
                let _ = execute!(stdout(), LeaveAlternateScreen);
                return Err(error.into());
            }
        };

        Ok(Self {
            terminal,
            paste_enabled,
            restored: false,
        })
    }

    fn restore(&mut self) -> Result<()> {
        if self.restored {
            return Ok(());
        }

        let raw_mode_result = disable_raw_mode();
        let paste_result = if self.paste_enabled {
            execute!(self.terminal.backend_mut(), DisableBracketedPaste)
        } else {
            Ok(())
        };
        let screen_result = execute!(self.terminal.backend_mut(), LeaveAlternateScreen);
        let cursor_result = self.terminal.show_cursor();
        self.restored = true;

        raw_mode_result?;
        paste_result?;
        screen_result?;
        cursor_result?;
        Ok(())
    }
}

impl Drop for TerminalSession {
    fn drop(&mut self) {
        if !self.restored {
            let _ = disable_raw_mode();
            if self.paste_enabled {
                let _ = execute!(self.terminal.backend_mut(), DisableBracketedPaste);
            }
            let _ = execute!(self.terminal.backend_mut(), LeaveAlternateScreen);
            let _ = self.terminal.show_cursor();
        }
    }
}
