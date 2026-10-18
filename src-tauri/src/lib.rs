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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default().plugin(
    tauri_plugin_sql::Builder::default()
      .add_migrations("sqlite:notes.db", notes_migrations())
      .build(),
  );

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
  use super::notes_migrations;

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
    let updated: String = sqlx::query_as("SELECT title FROM notes WHERE id = $1")
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
    let count: i64 = sqlx::query_as("SELECT COUNT(*) FROM notes")
      .fetch_one(&pool)
      .await
      .unwrap();
    assert_eq!(count, 0);
  }
}
