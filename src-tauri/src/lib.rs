pub fn notes_migrations() -> Vec<tauri_plugin_sql::Migration> {
  vec![tauri_plugin_sql::Migration {
    version: 1,
    description: "create_notes_table",
    sql: "CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      date       TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      blocks     TEXT NOT NULL DEFAULT '[]'
    );",
    kind: tauri_plugin_sql::MigrationKind::Up,
  }]
}

pub fn db_conn_url() -> Result<String, Box<dyn std::error::Error>> {
  // 本机安全软件（HIPS/反勒索驱动）按镜像路径拦截 exe 写 %APPDATA% 与 %TEMP%（只放行 exe 自身目录），
  // 故数据库放在 exe 旁边（与 webview-data 布局一致），不用 app_config_dir。
  let exe_dir = std::env::current_exe()?
    .parent()
    .ok_or("executable has no parent directory")?
    .to_path_buf();
  Ok(format!("sqlite:{}", exe_dir.join("notes.db").display()))
}

#[tauri::command]
fn get_sqlite_url() -> Result<String, String> {
  db_conn_url().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let db_url = db_conn_url().expect("resolve sqlite url");
  let builder = tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations(&db_url, notes_migrations())
        .build(),
    )
    .invoke_handler(tauri::generate_handler![get_sqlite_url]);

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

#[cfg(test)]
mod tests {
  use super::{db_conn_url, notes_migrations};

  #[test]
  fn db_conn_url_points_to_exe_sibling_notes_db() {
    let url = db_conn_url().unwrap();
    assert!(url.starts_with("sqlite:"));
    assert!(url.ends_with("notes.db"));
    let exe = std::env::current_exe().unwrap();
    let exe_dir = exe.parent().unwrap();
    let db_path = std::path::Path::new(&url["sqlite:".len()..]);
    assert!(db_path.starts_with(exe_dir));
  }

  #[tokio::test]
  async fn migration_builds_schema_and_crud_roundtrip() {
    let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
    for m in notes_migrations() {
      sqlx::query(&m.sql).execute(&pool).await.unwrap();
    }

    sqlx::query(
      "INSERT INTO notes (id, title, date, created_at, updated_at, blocks) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind("n1")
    .bind("标题")
    .bind("2026-10-17")
    .bind(1_i64)
    .bind(2_i64)
    .bind("[]")
    .execute(&pool)
    .await
    .unwrap();

    let row: (String, i64) =
      sqlx::query_as("SELECT title, updated_at FROM notes WHERE id = $1")
        .bind("n1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row.0, "标题");
    assert_eq!(row.1, 2);

    sqlx::query("UPDATE notes SET title = $2 WHERE id = $1")
      .bind("n1")
      .bind("改过的标题")
      .execute(&pool)
      .await
      .unwrap();
    let updated: String = sqlx::query_scalar("SELECT title FROM notes WHERE id = $1")
      .bind("n1")
      .fetch_one(&pool)
      .await
      .unwrap();
    assert_eq!(updated, "改过的标题");

    sqlx::query("DELETE FROM notes WHERE id = $1")
      .bind("n1")
      .execute(&pool)
      .await
      .unwrap();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM notes")
      .fetch_one(&pool)
      .await
      .unwrap();
    assert_eq!(count, 0);
  }
}
