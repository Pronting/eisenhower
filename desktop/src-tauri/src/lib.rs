//! ISHWE QuickNote — Tauri 2 backend.
//!
//! Provides:
//!   * Window control commands (toggle / show / hide / close)
//!   * Global shortcut registration (Ctrl+Shift+N by default)
//!   * System tray with "Show" and "Quit" menu
//!   * QR code generation for OAuth Device Flow authorization

use base64::Engine;
use qrcode::QrCode;
use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const DEFAULT_SHORTCUT: &str = "CommandOrControl+Shift+N";

/// Combined error type that can be serialized to the JS layer.
#[derive(Debug, thiserror::Error, Serialize)]
pub enum CommandError {
    #[error("Tauri error: {0}")]
    Tauri(String),
    #[error("QR code error: {0}")]
    Qr(String),
    #[error("Invalid input: {0}")]
    Invalid(String),
}

impl From<tauri::Error> for CommandError {
    fn from(e: tauri::Error) -> Self {
        CommandError::Tauri(e.to_string())
    }
}

impl From<qrcode::types::QrError> for CommandError {
    fn from(e: qrcode::types::QrError) -> Self {
        CommandError::Qr(e.to_string())
    }
}

// ---------------------------------------------------------------------------
// Window commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn toggle_window(app: AppHandle) -> Result<(), CommandError> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            window.hide()?;
        } else {
            window.show()?;
            window.set_focus()?;
        }
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), CommandError> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

#[tauri::command]
fn hide_window(app: AppHandle) -> Result<(), CommandError> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide()?;
    }
    Ok(())
}

/// Closing the window only hides it (keeps the tray icon alive).
#[tauri::command]
fn close_window(app: AppHandle) -> Result<(), CommandError> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide()?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// QR code generation
// ---------------------------------------------------------------------------

/// Generate a base64-encoded SVG QR code for the given text.
/// Returned string is suitable for use as an `<img src="data:image/svg+xml;base64,...">`.
#[tauri::command]
fn generate_qrcode(text: String) -> Result<String, CommandError> {
    let code = QrCode::new(text.as_bytes())?;
    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(200, 200)
        .build();
    let b64 = base64::engine::general_purpose::STANDARD.encode(svg.as_bytes());
    Ok(format!("data:image/svg+xml;base64,{}", b64))
}

// ---------------------------------------------------------------------------
// Global shortcut
// ---------------------------------------------------------------------------

/// Parse a shortcut string like "Ctrl+Shift+N" into a `Shortcut` value.
fn parse_shortcut(combo: &str) -> Result<Shortcut, CommandError> {
    let mut modifiers = Modifiers::empty();
    let mut code: Option<Code> = None;

    for part in combo.split('+') {
        match part.trim().to_uppercase().as_str() {
            "CTRL" | "CONTROL" | "COMMANDORCONTROL" => modifiers |= Modifiers::CONTROL,
            "SHIFT" => modifiers |= Modifiers::SHIFT,
            "ALT" => modifiers |= Modifiers::ALT,
            "SUPER" | "META" | "WIN" | "CMD" | "COMMAND" => modifiers |= Modifiers::SUPER,
            "N" => code = Some(Code::KeyN),
            "M" => code = Some(Code::KeyM),
            "K" => code = Some(Code::KeyK),
            "Q" => code = Some(Code::KeyQ),
            other => return Err(CommandError::Invalid(format!("unsupported key: {}", other))),
        }
    }

    let code = code.ok_or_else(|| CommandError::Invalid("missing key code".into()))?;
    Ok(Shortcut::new(Some(modifiers), code))
}

#[tauri::command]
fn register_shortcut(
    app: AppHandle,
    combination: String,
) -> Result<String, CommandError> {
    let shortcut = parse_shortcut(&combination)?;
    let gs = app.global_shortcut();

    // Always unregister any existing shortcut first to avoid double-registration panics.
    let _ = gs.unregister_all();

    let app_handle = app.clone();
    gs.on_shortcut(shortcut, move |_app, _sc, event| {
        if event.state == ShortcutState::Pressed {
            if let Some(window) = app_handle.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
    })
    .map_err(|e| CommandError::Tauri(format!("register failed: {}", e)))?;

    Ok(format!("registered: {}", combination))
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            toggle_window,
            show_main_window,
            hide_window,
            close_window,
            generate_qrcode,
            register_shortcut,
        ])
        .setup(|app| {
            // ---- System tray ------------------------------------------------
            let show_item = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ISHWE QuickNote")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // ---- Default global shortcut -----------------------------------
            if let Ok(default) = parse_shortcut(DEFAULT_SHORTCUT) {
                let gs = app.global_shortcut();
                let _ = gs.unregister(default.clone());
                if let Err(e) = gs.on_shortcut(default, |_app, _sc, event| {
                    if event.state == ShortcutState::Pressed {
                        // The visible handler is wired through the frontend
                        // (which calls toggle_window via invoke). The Rust
                        // shortcut is kept here as a fallback for power users.
                    }
                }) {
                    eprintln!("default shortcut register failed: {}", e);
                }
            }

            // ---- Window close → hide, not exit -----------------------------
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                });

                // Show the window shortly after launch so it does not feel unresponsive.
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    if let Some(w) = app_handle.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // Keep the app alive when the last window is closed — exit only on explicit quit.
            if let RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
