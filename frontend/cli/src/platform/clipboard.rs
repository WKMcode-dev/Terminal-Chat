use std::{
    io::Write,
    process::{Command, Stdio},
};

use anyhow::{Context, Result, anyhow};

pub fn copy_text(text: &str) -> Result<()> {
    platform_copy(text)
}

#[cfg(windows)]
fn platform_copy(text: &str) -> Result<()> {
    const POWERSHELL_SCRIPT: &str = concat!(
        "[Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false); ",
        "$text=[Console]::In.ReadToEnd(); Set-Clipboard -Value $text"
    );

    copy_with_command(
        "powershell.exe",
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-STA",
            "-Command",
            POWERSHELL_SCRIPT,
        ],
        text,
    )
    .context("não foi possível acessar a área de transferência do Windows")
}

#[cfg(target_os = "macos")]
fn platform_copy(text: &str) -> Result<()> {
    copy_with_command("pbcopy", &[], text)
        .context("não foi possível acessar a área de transferência do macOS")
}

#[cfg(all(unix, not(target_os = "macos")))]
fn platform_copy(text: &str) -> Result<()> {
    for (program, arguments) in [
        ("wl-copy", &[][..]),
        ("xclip", &["-selection", "clipboard"][..]),
        ("xsel", &["--clipboard", "--input"][..]),
    ] {
        if copy_with_command(program, arguments, text).is_ok() {
            return Ok(());
        }
    }

    Err(anyhow!(
        "instale wl-copy, xclip ou xsel para habilitar a cópia neste ambiente"
    ))
}

fn copy_with_command(program: &str, arguments: &[&str], text: &str) -> Result<()> {
    let mut child = Command::new(program)
        .args(arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .with_context(|| format!("não foi possível iniciar {program}"))?;

    child
        .stdin
        .take()
        .context("o processo de cópia não aceitou texto")?
        .write_all(text.as_bytes())?;

    let status = child.wait()?;
    if status.success() {
        Ok(())
    } else {
        Err(anyhow!("{program} encerrou com o status {status}"))
    }
}
