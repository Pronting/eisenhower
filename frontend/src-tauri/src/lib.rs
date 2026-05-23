use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn toggle_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn close_window(app: tauri::AppHandle) {
    // 隐藏到系统托盘，而不是真正关闭
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn update_shortcut(app: tauri::AppHandle, shortcut_str: String) -> Result<String, String> {
    let gs = app.global_shortcut();

    // 先注销所有已注册的快捷键
    let _ = gs.unregister_all();

    // 解析快捷键字符串，例如 "Ctrl+Shift+F7"
    let parts: Vec<&str> = shortcut_str.split('+').collect();
    let mut modifiers = Modifiers::empty();
    let mut code = None;

    for part in &parts {
        match part.trim().to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "shift" => modifiers |= Modifiers::SHIFT,
            "alt" => modifiers |= Modifiers::ALT,
            "super" | "meta" | "win" => modifiers |= Modifiers::SUPER,
            key => {
                code = Some(match key.to_uppercase().as_str() {
                    "F1" => Code::F1,
                    "F2" => Code::F2,
                    "F3" => Code::F3,
                    "F4" => Code::F4,
                    "F5" => Code::F5,
                    "F6" => Code::F6,
                    "F7" => Code::F7,
                    "F8" => Code::F8,
                    "F9" => Code::F9,
                    "F10" => Code::F10,
                    "F11" => Code::F11,
                    "F12" => Code::F12,
                    "A" => Code::KeyA,
                    "B" => Code::KeyB,
                    "C" => Code::KeyC,
                    "D" => Code::KeyD,
                    "E" => Code::KeyE,
                    "F" => Code::KeyF,
                    "G" => Code::KeyG,
                    "H" => Code::KeyH,
                    "I" => Code::KeyI,
                    "J" => Code::KeyJ,
                    "K" => Code::KeyK,
                    "L" => Code::KeyL,
                    "M" => Code::KeyM,
                    "N" => Code::KeyN,
                    "O" => Code::KeyO,
                    "P" => Code::KeyP,
                    "Q" => Code::KeyQ,
                    "R" => Code::KeyR,
                    "S" => Code::KeyS,
                    "T" => Code::KeyT,
                    "U" => Code::KeyU,
                    "V" => Code::KeyV,
                    "W" => Code::KeyW,
                    "X" => Code::KeyX,
                    "Y" => Code::KeyY,
                    "Z" => Code::KeyZ,
                    "0" => Code::Digit0,
                    "1" => Code::Digit1,
                    "2" => Code::Digit2,
                    "3" => Code::Digit3,
                    "4" => Code::Digit4,
                    "5" => Code::Digit5,
                    "6" => Code::Digit6,
                    "7" => Code::Digit7,
                    "8" => Code::Digit8,
                    "9" => Code::Digit9,
                    "SPACE" => Code::Space,
                    "ENTER" => Code::Enter,
                    "ESCAPE" | "ESC" => Code::Escape,
                    "TAB" => Code::Tab,
                    "BACKSPACE" => Code::Backspace,
                    "DELETE" | "DEL" => Code::Delete,
                    "INSERT" | "INS" => Code::Insert,
                    "HOME" => Code::Home,
                    "END" => Code::End,
                    "PAGEUP" => Code::PageUp,
                    "PAGEDOWN" => Code::PageDown,
                    "UP" => Code::ArrowUp,
                    "DOWN" => Code::ArrowDown,
                    "LEFT" => Code::ArrowLeft,
                    "RIGHT" => Code::ArrowRight,
                    _ => return Err(format!("不支持的按键: {}", key)),
                });
            }
        }
    }

    let code = code.ok_or("缺少按键定义")?;
    let shortcut = Shortcut::new(Some(modifiers), code);

    // 注册新快捷键
    let app_handle = app.clone();
    gs.on_shortcut(
        shortcut,
        move |_app, _shortcut, event| {
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
        },
    ).map_err(|e| format!("注册快捷键失败: {}", e))?;

    Ok(format!("快捷键 {} 注册成功", shortcut_str))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![toggle_window, hide_window, close_window, show_main_window, update_shortcut])
        .setup(|app| {
            // 创建系统托盘菜单
            let show_item = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            // 创建系统托盘图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ishwe - 随处小记")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
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

            let handle = app.handle().clone();
            let shortcut_handle = handle.clone();

            // 注册快捷键 Ctrl+Shift+F7（避免与之前的 Ctrl+F7 冲突）
            let gs = handle.global_shortcut();
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::F7);

            // 先尝试注销已存在的快捷键（忽略错误）
            let _ = gs.unregister(shortcut.clone());

            // 尝试注册快捷键
            match gs.on_shortcut(
                shortcut,
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(window) = shortcut_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                },
            ) {
                Ok(_) => println!("快捷键 Ctrl+Shift+F7 注册成功"),
                Err(e) => println!("快捷键 Ctrl+Shift+F7 注册失败: {}", e),
            }

            // 等待页面加载完成后再显示窗口
            let app_handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(true) = event {
                        // 窗口获得焦点时确保可见
                        let _ = window_clone.show();
                    }
                });
            }

            // 延迟显示窗口，确保页面加载完成
            let app_handle_clone = app_handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if let Some(window) = app_handle_clone.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
