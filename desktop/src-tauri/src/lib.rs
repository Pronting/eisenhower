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
use tauri_plugin_notification::NotificationExt;

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
        let p = part.trim();
        // Modifiers (case-insensitive)
        match p.to_uppercase().as_str() {
            "CTRL" | "CONTROL" | "COMMANDORCONTROL" => modifiers |= Modifiers::CONTROL,
            "SHIFT" => modifiers |= Modifiers::SHIFT,
            "ALT" => modifiers |= Modifiers::ALT,
            "SUPER" | "META" | "WIN" | "CMD" | "COMMAND" => modifiers |= Modifiers::SUPER,
            _ => {}
        }
        // F1-F12
        if let Some(n) = p.strip_prefix('F').or_else(|| p.strip_prefix('f')) {
            if let Ok(num) = n.parse::<u8>() {
                let c = match num {
                    1 => Code::F1, 2 => Code::F2, 3 => Code::F3, 4 => Code::F4,
                    5 => Code::F5, 6 => Code::F6, 7 => Code::F7, 8 => Code::F8,
                    9 => Code::F9, 10 => Code::F10, 11 => Code::F11, 12 => Code::F12,
                    _ => return Err(CommandError::Invalid(format!("unsupported F-key: {}", num))),
                };
                code = Some(c);
                continue;
            }
        }
        // Single character (A-Z, 0-9, space, named keys)
        let upper = p.to_uppercase();
        code = Some(match upper.as_str() {
            "SPACE" => Code::Space,
            "ENTER" | "RETURN" => Code::Enter,
            "ESCAPE" | "ESC" => Code::Escape,
            "TAB" => Code::Tab,
            "BACKSPACE" => Code::Backspace,
            "DELETE" | "DEL" => Code::Delete,
            "INSERT" | "INS" => Code::Insert,
            "HOME" => Code::Home,
            "END" => Code::End,
            "PAGEUP" | "PGUP" => Code::PageUp,
            "PAGEDOWN" | "PGDN" => Code::PageDown,
            "UP" => Code::ArrowUp,
            "DOWN" => Code::ArrowDown,
            "LEFT" => Code::ArrowLeft,
            "RIGHT" => Code::ArrowRight,
            _ if upper.len() == 1 => {
                let ch = upper.chars().next().unwrap();
                match ch {
                    'A' => Code::KeyA, 'B' => Code::KeyB, 'C' => Code::KeyC,
                    'D' => Code::KeyD, 'E' => Code::KeyE, 'F' => Code::KeyF,
                    'G' => Code::KeyG, 'H' => Code::KeyH, 'I' => Code::KeyI,
                    'J' => Code::KeyJ, 'K' => Code::KeyK, 'L' => Code::KeyL,
                    'M' => Code::KeyM, 'N' => Code::KeyN, 'O' => Code::KeyO,
                    'P' => Code::KeyP, 'Q' => Code::KeyQ, 'R' => Code::KeyR,
                    'S' => Code::KeyS, 'T' => Code::KeyT, 'U' => Code::KeyU,
                    'V' => Code::KeyV, 'W' => Code::KeyW, 'X' => Code::KeyX,
                    'Y' => Code::KeyY, 'Z' => Code::KeyZ,
                    '0' => Code::Digit0, '1' => Code::Digit1, '2' => Code::Digit2,
                    '3' => Code::Digit3, '4' => Code::Digit4, '5' => Code::Digit5,
                    '6' => Code::Digit6, '7' => Code::Digit7, '8' => Code::Digit8,
                    '9' => Code::Digit9,
                    _ => return Err(CommandError::Invalid(format!("unsupported key: {}", ch))),
                }
            }
            _ => return Err(CommandError::Invalid(format!("unsupported key: {}", p))),
        });
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
// Notifications
// ---------------------------------------------------------------------------

/// Send an OS-level notification (Windows toast / Linux libnotify / macOS NSUserNotification).
/// Returns `true` on success, `false` if the platform refused (e.g. permission denied).
#[tauri::command]
fn send_notification(app: AppHandle, title: String, body: String) -> Result<bool, CommandError> {
    let result = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
    Ok(result.is_ok())
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
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            toggle_window,
            show_main_window,
            hide_window,
            close_window,
            generate_qrcode,
            register_shortcut,
            send_notification,
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
                    "quit" => {
                        // Force-quit all threads/processes; works around platforms
                        // where the event loop refuses to exit cleanly.
                        app.exit(0);
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Explicitly branch on the mouse button so left/right never
                    // get confused. Left toggles the window, right is handled
                    // by the OS (it shows the registered menu automatically).
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
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
                        // Right click is automatically shown by the OS
                        // (because we registered `.menu(&menu)` above).
                        // We intentionally do nothing here to avoid a
                        // double-menu flash.
                        _ => {}
                    }
                })
                .build(app)?;

            // ---- Default global shortcut -----------------------------------
            if let Ok(default) = parse_shortcut(DEFAULT_SHORTCUT) {
                let gs = app.global_shortcut();
                let _ = gs.unregister(default.clone());
                let shortcut_app = app.handle().clone();
                if let Err(e) = gs.on_shortcut(default, move |_app, _sc, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(window) = shortcut_app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
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
