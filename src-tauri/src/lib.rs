use serde::Serialize;
use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const LOG_FILE_NAME: &str = "hf-antenna-studio.log";
const MAX_FRONTEND_LOG_LENGTH: usize = 4_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfo {
    packaged: bool,
    version: String,
    log_directory: String,
    project_storage: String,
}

fn log_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|error| format!("Unable to resolve the application log directory: {error}"))
}

fn sanitise_log_text(value: &str) -> String {
    value
        .chars()
        .take(MAX_FRONTEND_LOG_LENGTH)
        .map(|character| {
            if matches!(character, '\r' | '\n' | '\0') {
                ' '
            } else {
                character
            }
        })
        .collect::<String>()
}

fn write_diagnostic(app: &AppHandle, level: &str, message: &str) -> Result<(), String> {
    let directory = log_directory(app)?;
    create_dir_all(&directory)
        .map_err(|error| format!("Unable to create the application log directory: {error}"))?;
    let path = directory.join(LOG_FILE_NAME);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("Unable to open the application log file: {error}"))?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock is before the Unix epoch: {error}"))?
        .as_secs();
    writeln!(
        file,
        "{timestamp} [{}] {}",
        sanitise_log_text(level).to_uppercase(),
        sanitise_log_text(message)
    )
    .map_err(|error| format!("Unable to append to the application log: {error}"))
}

#[tauri::command]
fn get_runtime_info(app: AppHandle) -> Result<RuntimeInfo, String> {
    Ok(RuntimeInfo {
        packaged: true,
        version: app.package_info().version.to_string(),
        log_directory: log_directory(&app)?.display().to_string(),
        project_storage: "Browser-local project data in the dedicated HF Antenna Studio WebView profile; uninstall preserves this user data by policy.".to_string(),
    })
}

#[tauri::command]
fn append_diagnostic_log(app: AppHandle, level: String, message: String) -> Result<(), String> {
    let normalised_level = match level.to_ascii_lowercase().as_str() {
        "error" => "error",
        "warn" | "warning" => "warn",
        _ => "info",
    };
    write_diagnostic(&app, normalised_level, &message)
}

#[tauri::command]
fn open_log_directory(app: AppHandle) -> Result<(), String> {
    let directory = log_directory(&app)?;
    create_dir_all(&directory)
        .map_err(|error| format!("Unable to create the application log directory: {error}"))?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&directory)
            .spawn()
            .map_err(|error| format!("Unable to open the application log directory: {error}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(
            "Opening the log directory is currently supported only by the Windows package."
                .to_string(),
        )
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(error) = write_diagnostic(
                app.handle(),
                "info",
                &format!("HF Antenna Studio {} started", app.package_info().version),
            ) {
                eprintln!("Unable to initialize the diagnostic log: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            append_diagnostic_log,
            open_log_directory
        ])
        .run(tauri::generate_context!())
        .expect("HF Antenna Studio desktop runtime failed");
}
