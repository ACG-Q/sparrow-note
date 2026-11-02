use tauri::webview::{PermissionKind, PermissionResponse};

mod storage;

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
/// - **用户自定义目录**：设置里换过位置就用它（配置在 `storage.json`），写不进去自动回落。
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

  // 用户在设置里换过位置：能用就用（桌面 / 安卓都一样），用不了回落默认并保留旧库
  if let Some(dir) = crate::storage::custom_dir(app) {
    if crate::storage::dir_writable(&dir) {
      return Ok(sqlite_url(&dir));
    }
    eprintln!(
      "[sparrow] 自定义数据目录不可写，回落到默认位置：{}",
      dir.display()
    );
  }

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
  format!("sqlite:{}", crate::storage::db_path(dir).display())
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

/// 当前存储状态：库在哪、多大、有哪些位置可选
#[tauri::command]
fn storage_status(app: tauri::AppHandle) -> Result<storage::StorageStatus, String> {
  use tauri::Manager;

  let current = db_conn_url(&app).map_err(|e| e.to_string())?;
  let db_file = std::path::PathBuf::from(current.trim_start_matches("sqlite:"));
  let dir = db_file
    .parent()
    .ok_or_else(|| "数据库路径没有父目录".to_string())?
    .to_path_buf();

  let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let default_dir = default_dir_for_ui(&app, &app_dir);
  let custom = storage::custom_dir(&app);
  let is_custom = dir != default_dir;

  // 安卓上的「外部目录」= getExternalFilesDir(Documents)，落在共享存储的 Android/data 下
  let external = external_dir(&app);
  let options = storage::candidate_dirs(
    &app_dir,
    external.as_deref(),
    custom.as_deref(),
  );
  // 正在用自定义目录、但它不在候选里（比如桌面的自定义位置上次没列出来）也补一条
  let mut options = options;
  if is_custom && !options.iter().any(|o| o.path == dir.display().to_string()) {
    options.push(storage::DirOption {
      kind: "custom",
      path: dir.display().to_string(),
      label: "自定义位置".into(),
      hint: "当前正在使用".into(),
    });
  }

  Ok(storage::StorageStatus {
    kind: "sqlite",
    path: db_file.display().to_string(),
    dir: dir.display().to_string(),
    size_bytes: storage::db_size(&dir),
    is_custom,
    default_dir: default_dir.display().to_string(),
    can_choose: options.len() > 1 || cfg!(not(any(target_os = "android", target_os = "ios"))),
    custom_dir: custom.map(|p| p.display().to_string()),
    options,
  })
}

/// 应用外部目录（只有安卓有）；桌面/ iOS 返回 None
#[allow(unused_variables, unused_imports)]
fn external_dir(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
  use tauri::Manager;
  #[cfg(target_os = "android")]
  {
    app.path().document_dir().ok()
  }
  #[cfg(not(target_os = "android"))]
  {
    None
  }
}

/// 界面里「默认位置」应该显示哪个：桌面 debug 在 exe 旁，其余在用户数据目录
#[allow(unused_variables)]
fn default_dir_for_ui(app: &tauri::AppHandle, app_dir: &std::path::Path) -> std::path::PathBuf {
  #[cfg(any(target_os = "android", target_os = "ios"))]
  {
    app_dir.to_path_buf()
  }
  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  {
    if cfg!(debug_assertions) {
      legacy_exe_dir().unwrap_or_else(|| app_dir.to_path_buf())
    } else {
      app_dir.to_path_buf()
    }
  }
}

/// 换位置前的检查：目录能不能用、里面是不是已经有库了。
///
/// 放在 Rust 里做而不是前端用 fs 插件的 `exists`：fs 插件查文件要过 scope，
/// 应用外部目录（`$DOCUMENT`）不在 AppData 作用域里，会被判成 forbidden path。
/// 这里用 `std::fs` 直接看，不受前端 scope 限制。
///
/// `force = true` 时把目标目录里的旧库改名成 `notes.db.bak-<时间戳>` 留档，
/// 而不是直接删掉——换回原位置时那份旧数据用户可能还要。
#[tauri::command]
fn prepare_data_dir(
  app: tauri::AppHandle,
  dir: String,
  force: Option<bool>,
) -> Result<storage::PrepareDir, String> {
  use tauri::Manager;
  use std::time::{SystemTime, UNIX_EPOCH};

  let target = storage::normalize_dir(&dir)?;

  let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let external = external_dir(&app);
  let custom = storage::custom_dir(&app);
  let candidates = storage::candidate_dirs(&app_dir, external.as_deref(), custom.as_deref());
  if !storage::dir_allowed(&target, &candidates) {
    return Err("这个目录不允许：安卓上只能选应用私有目录或应用外部目录".into());
  }
  if !storage::dir_writable(&target) {
    return Err(format!("这个目录写不进去：{}", target.display()));
  }

  let db_file = storage::db_path(&target);
  let exists = db_file.exists();
  let md = std::fs::metadata(&db_file).ok();
  let old_bytes = md.as_ref().map(|m| m.len()).unwrap_or(0);
  let old_modified = md
    .and_then(|m| m.modified().ok())
    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
    .map(|d| d.as_millis() as u64);

  let moved_aside = if exists && force.unwrap_or(false) {
    let stamp = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map(|d| d.as_secs())
      .unwrap_or(0);
    storage::move_existing_db_aside(&target, stamp).map_err(|e| format!("挪开旧库失败：{e}"))?
  } else {
    None
  };

  Ok(storage::PrepareDir {
    exists: exists && moved_aside.is_none(),
    db_path: db_file.display().to_string(),
    old_bytes,
    old_modified,
    moved_aside,
  })
}

/// 记下新的数据目录。**复制库文件是调用方的事**（先 VACUUM INTO 再调这里，最后重启）。
///
/// 移动端只放行候选目录（应用私有 / 应用外部）：SQLite 需要真实路径，
/// 系统文件选择器给的 `content://` URI 用不了，所以不能随便指一个目录。
#[tauri::command]
fn set_data_dir(app: tauri::AppHandle, dir: String) -> Result<(), String> {
  use tauri::Manager;

  let target = storage::normalize_dir(&dir)?;

  let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let external = external_dir(&app);
  let custom = storage::custom_dir(&app);
  let candidates = storage::candidate_dirs(&app_dir, external.as_deref(), custom.as_deref());
  if !storage::dir_allowed(&target, &candidates) {
    return Err("这个目录不允许：安卓上只能选应用私有目录或应用外部目录".into());
  }

  if !storage::dir_writable(&target) {
    return Err(format!("这个目录写不进去：{}", target.display()));
  }

  storage::write_config(
    &app,
    &storage::StorageConfig {
      data_dir: Some(target.display().to_string()),
    },
  )
}

/// 恢复默认位置（旧库不删，随时能改回来）
#[tauri::command]
fn reset_data_dir(app: tauri::AppHandle) -> Result<(), String> {
  storage::write_config(&app, &storage::StorageConfig::default())
}

/// 换完位置要重启才生效
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
  app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_geolocation::init())
    // 移动端导出：dialog 负责弹系统「另存为」，fs 负责真正写盘。
    // 安卓上 dialog 返回的是 content:// URI，fs 的 ContentResolver 分支认得它。
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    // 安卓上选数据目录（plugin-dialog 在移动端不实现目录选择器）
    .plugin(tauri_plugin_sparrow_storage::init())
    .invoke_handler(tauri::generate_handler![
      get_sqlite_url,
      storage_status,
      prepare_data_dir,
      set_data_dir,
      reset_data_dir,
      restart_app
    ]);

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
