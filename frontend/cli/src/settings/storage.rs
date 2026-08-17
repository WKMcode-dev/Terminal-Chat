use std::{
    env, fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};

use super::UserSettings;

const APP_DIRECTORY: &str = "terminal-chat";
const SETTINGS_FILE: &str = "settings.json";
const CONFIG_OVERRIDE: &str = "TERMINAL_CHAT_CONFIG_DIR";

pub fn load() -> Result<UserSettings> {
    let path = settings_path();
    if !path.exists() {
        return Ok(UserSettings::default());
    }

    let contents = fs::read_to_string(&path)
        .with_context(|| format!("não foi possível ler {}", path.display()))?;
    let mut settings: UserSettings = serde_json::from_str(&contents)
        .with_context(|| format!("configuração inválida em {}", path.display()))?;
    settings.normalize();
    Ok(settings)
}

pub fn save(settings: &UserSettings) -> Result<()> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("não foi possível criar {}", parent.display()))?;
    }

    let contents = serde_json::to_string_pretty(settings)?;
    fs::write(&path, contents)
        .with_context(|| format!("não foi possível salvar {}", path.display()))
}

pub fn settings_path() -> PathBuf {
    config_base_directory().join(APP_DIRECTORY).join(SETTINGS_FILE)
}

fn config_base_directory() -> PathBuf {
    if let Some(path) = env::var_os(CONFIG_OVERRIDE).filter(|value| !value.is_empty()) {
        return PathBuf::from(path);
    }

    platform_config_directory().unwrap_or_else(fallback_config_directory)
}

#[cfg(windows)]
fn platform_config_directory() -> Option<PathBuf> {
    env::var_os("APPDATA").map(PathBuf::from)
}

#[cfg(not(windows))]
fn platform_config_directory() -> Option<PathBuf> {
    env::var_os("XDG_CONFIG_HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| Path::new(&home).join(".config")))
}

fn fallback_config_directory() -> PathBuf {
    env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_file_has_a_stable_name() {
        assert_eq!(settings_path().file_name().unwrap(), SETTINGS_FILE);
    }
}
