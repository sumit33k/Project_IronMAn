use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Jarvis Command Center.", name)
}

#[tauri::command]
fn enable_autostart(app: tauri::AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    let _ = app.autolaunch().enable();
}

#[tauri::command]
fn disable_autostart(app: tauri::AppHandle) {
    use tauri_plugin_autostart::ManagerExt;
    let _ = app.autolaunch().disable();
}

#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--flag1"])))
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Show Jarvis", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide Jarvis", true, None::<&str>)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let autostart_item = MenuItem::with_id(app, "autostart", "Start on Login", true, None::<&str>)?;
            let separator2 = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Jarvis", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[
                    &show_item,
                    &hide_item,
                    &separator,
                    &autostart_item,
                    &separator2,
                    &quit_item,
                ],
            )?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("Jarvis Command Center")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.unminimize();
                            }
                        }
                        "hide" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                        "autostart" => {
                            use tauri_plugin_autostart::ManagerExt;
                            let enabled = app.autolaunch().is_enabled().unwrap_or(false);
                            if enabled {
                                let _ = app.autolaunch().disable();
                            } else {
                                let _ = app.autolaunch().enable();
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
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // On macOS, hide the dock icon since we use system tray
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // On close, hide to tray instead of quitting
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![greet, enable_autostart, disable_autostart, is_autostart_enabled])
        .run(tauri::generate_context!())
        .expect("error while running Jarvis Command Center");
}
