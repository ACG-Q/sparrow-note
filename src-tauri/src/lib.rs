use tauri::webview::{PermissionKind, PermissionResponse};

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

/// 数据库位置，按构建阶段决定：
/// - **开发（debug 构建）**：放在 exe 旁边。`tauri dev` 编的是 debug，本地调试时
///   不会被安全软件的文件保护规则干扰，也不用去翻 AppData。
/// - **打包（release 构建）**：放在用户数据目录（Windows 上是 `%APPDATA%\com.sparrow.note`）。
///   这是标准位置，装到 Program Files 这种只读目录也能存。
/// - **移动端**：exe 目录是只读的应用包，只能用应用私有数据目录。
///
/// 兜底：万一目标目录写不进去（只读盘、被安全软件拦），再换另一个位置试一次。
/// 老版本把库放在 exe 旁边，搬到 AppData 时会自动迁移一次。
pub fn db_conn_url(app: &tauri::AppHandle) -> Result<String, Box<dyn std::error::Error>> {
  use tauri::Manager;

  #[cfg(any(target_os = "android", target_os = "ios"))]
  {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    return Ok(sqlite_url(&dir));
  }

  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  {
    let app_dir = app.path().app_data_dir()?;
    let exe_dir = legacy_exe_dir();

    // 开发阶段用 exe 旁边；打包后优先 AppData
    let preferred = if cfg!(debug_assertions) {
      exe_dir.clone().unwrap_or_else(|| app_dir.clone())
    } else {
      app_dir.clone()
    };

    if dir_writable(&preferred) {
      // 打包版换了位置，把开发期间写在 exe 旁边的库搬过去
      if preferred == app_dir {
        migrate_legacy_db(&app_dir, exe_dir);
      }
      return Ok(sqlite_url(&preferred));
    }

    // 兜底：换另一个位置再试
    let other = if preferred == app_dir {
      exe_dir
    } else {
      Some(app_dir.clone())
    };
    if let Some(dir) = other {
      if dir_writable(&dir) {
        return Ok(sqlite_url(&dir));
      }
    }

    // 都不行就还给首选位置，让错误信息指向正确的地方
    Ok(sqlite_url(&preferred))
  }
}

fn sqlite_url(dir: &std::path::Path) -> String {
  format!("sqlite:{}", dir.join("notes.db").display())
}

/// 真正试写一次，别只看 create_dir_all 是否成功
fn dir_writable(dir: &std::path::Path) -> bool {
  if std::fs::create_dir_all(dir).is_err() {
    return false;
  }
  let probe = dir.join(".write-probe");
  match std::fs::write(&probe, b"ok") {
    Ok(_) => {
      let _ = std::fs::remove_file(&probe);
      true
    }
    Err(_) => false,
  }
}

/// 老版本把 notes.db 放在 exe 同目录；换位置后搬一次，别让人以为笔记丢了。
fn legacy_exe_dir() -> Option<std::path::PathBuf> {
  std::env::current_exe().ok()?.parent().map(|p| p.to_path_buf())
}

fn migrate_legacy_db(new_dir: &std::path::Path, legacy_dir: Option<std::path::PathBuf>) {
  let Some(old) = legacy_dir else { return };
  let target = new_dir.join("notes.db");
  if target.exists() {
    return;
  }
  let src = old.join("notes.db");
  if !src.exists() || src == target {
    return;
  }
  // WAL 模式下未合并的数据在同名 -wal 里，一并搬
  for suffix in ["", "-wal", "-shm"] {
    let from = old.join(format!("notes.db{suffix}"));
    let to = new_dir.join(format!("notes.db{suffix}"));
    if from.exists() {
      let _ = std::fs::copy(&from, &to);
    }
  }
}


#[tauri::command]
fn get_sqlite_url(app: tauri::AppHandle) -> Result<String, String> {
  db_conn_url(&app).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_geolocation::init())
    .invoke_handler(tauri::generate_handler![get_sqlite_url]);

  // MCP bridge 只给桌面调试用：它调用了 WebviewWindow 的 minimize/maximize，
  // 这两个方法在安卓上不存在，所以这里和 Cargo.toml 都限定成非移动端。
  #[cfg(all(debug_assertions, not(any(target_os = "android", target_os = "ios"))))]
  let builder = builder.plugin(
    tauri_plugin_mcp_bridge::Builder::new()
      .bind_address("127.0.0.1")
      .build(),
  );

  builder
    .setup(|app| {
      // sql 插件要等拿到 app handle 才知道数据库该放哪（桌面在 exe 旁、移动端在应用私有目录）
      let db_url = db_conn_url(app.handle())?;
      app.handle().plugin(
        tauri_plugin_sql::Builder::default()
          .add_migrations(&db_url, notes_migrations())
          .build(),
      )?;

      // 下面这几段都是桌面专属：
      // - 日志目录、WebView 数据目录都放在 exe 旁边（安卓上那是只读的应用包，会 panic）；
      // - 窗口在桌面由这里手动建（配置里 create=false），移动端由 Android 侧创建。
      #[cfg(desktop)]
      {
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
          // WebView2 默认拒绝一切权限请求：不装处理器的话录音和扫码都拿不到设备。
          // 这两样都由用户主动触发（点录音 / 打开扫码），直接放行。
          // 定位不在这里解决：tauri-plugin-geolocation 的桌面实现是空壳（返回 0,0），
          // 界面那边对 Windows 明说暂不支持，引导去「搜地点」。
          .on_permission_request(|_, kind| match kind {
            PermissionKind::Geolocation | PermissionKind::Microphone | PermissionKind::Camera => {
              PermissionResponse::Allow
            }
            _ => PermissionResponse::Default,
          })
          .build()?;
      }

      #[cfg(not(desktop))]
      {
        // 配置里 create=false（桌面由上面手动建，好把 WebView 数据目录放到 exe 旁边），
        // 移动端没有那段代码，就得在这里把窗口建出来，否则界面是白的。
        let window_config = app
          .config()
          .app
          .windows
          .iter()
          .find(|w| w.label == "main")
          .cloned()
          .ok_or("window config with label `main` not found")?;

        tauri::WebviewWindowBuilder::from_config(app.handle(), &window_config)?.build()?;
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
  use super::{migrate_legacy_db, notes_migrations};

  #[test]
  fn moves_legacy_db_out_of_the_exe_folder() {
    // 不用 %TEMP%：本机安全软件会拦编译出来的新程序写临时目录
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
      .join("target")
      .join("test-tmp")
      .join(format!("migrate-{}", std::process::id()));
    let old = root.join("exe");
    let new = root.join("appdata");
    std::fs::create_dir_all(&old).unwrap();
    std::fs::create_dir_all(&new).unwrap();
    std::fs::write(old.join("notes.db"), b"db").unwrap();
    std::fs::write(old.join("notes.db-wal"), b"wal").unwrap();

    migrate_legacy_db(&new, Some(old.clone()));
    assert_eq!(std::fs::read(new.join("notes.db")).unwrap(), b"db");
    assert_eq!(std::fs::read(new.join("notes.db-wal")).unwrap(), b"wal");

    // 新位置已经有库就不再覆盖
    std::fs::write(new.join("notes.db"), b"existing").unwrap();
    migrate_legacy_db(&new, Some(old));
    assert_eq!(std::fs::read(new.join("notes.db")).unwrap(), b"existing");

    std::fs::remove_dir_all(&root).ok();
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
