#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();

  #[cfg(debug_assertions)]
  let builder = builder.plugin(
    tauri_plugin_mcp_bridge::Builder::new()
      .bind_address("127.0.0.1")
      .build(),
  );

  builder
    .setup(|app| {
      let base_dir = std::env::current_exe()?
        .parent()
        .ok_or("executable has no parent directory")?
        .join("webview-data");

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .clear_targets()
            .target(tauri_plugin_log::Target::new(
              tauri_plugin_log::TargetKind::Stdout,
            ))
            .target(tauri_plugin_log::Target::new(
              tauri_plugin_log::TargetKind::Folder {
                path: base_dir.join("logs"),
                file_name: None,
              },
            ))
            .build(),
        )?;
      }

      let window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .ok_or("window config with label `main` not found")?;

      tauri::WebviewWindowBuilder::from_config(app.handle(), &window_config)?
        .data_directory(base_dir)
        .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
