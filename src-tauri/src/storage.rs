//! 数据存储位置：默认位置、用户自定义目录、以及一份小配置文件。
//!
//! 为什么配置不能放在数据库里：这份配置要回答的正是「数据库在哪」，放进去就成了鸡生蛋。
//! 所以放在应用配置目录下的 `storage.json`（Windows：`%APPDATA%\com.sparrow.note\storage.json`）。
//!
//! 换位置只改这份配置，**不删旧库**——万一新位置有问题，用户还能指回默认位置把数据找回来。

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

pub const CONFIG_NAME: &str = "storage.json";
pub const DB_NAME: &str = "notes.db";

/// 落盘的配置（目前只有一项，留成结构体方便以后加）
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct StorageConfig {
    /// 用户选的数据目录；`None` = 用默认位置
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_dir: Option<String>,
}

impl StorageConfig {
    /// 从 JSON 文本读；坏掉的配置按「用默认位置」处理，不要让应用起不来
    pub fn from_json(text: &str) -> Self {
        serde_json::from_str(text).unwrap_or_default()
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".into())
    }

    /// 配置里的自定义目录（空串当没设）
    pub fn dir(&self) -> Option<PathBuf> {
        self.data_dir
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
    }
}

/// 可选的一个存放位置
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirOption {
    /// private = 应用私有目录；external = 应用外部（共享存储）；custom = 桌面端自己选的
    pub kind: &'static str,
    pub path: String,
    pub label: String,
    pub hint: String,
}

/// 给界面看的状态
///
/// 注意 `rename_all = "camelCase"`：Tauri 只给**参数**做命名转换，返回值原样序列化，
/// 不加这一行前端读到的就是 `size_bytes`，界面上会全是 0 / undefined。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStatus {
    /// 目前只会有 sqlite；浏览器那边根本走不到这里
    pub kind: &'static str,
    /// 当前数据库文件（绝对路径）
    pub path: String,
    /// 当前数据目录
    pub dir: String,
    /// 库文件 + WAL/SHM 的总大小
    pub size_bytes: u64,
    /// 是否没在用默认目录
    pub is_custom: bool,
    /// 默认数据目录（「恢复默认」用）
    pub default_dir: String,
    /// 这个平台能不能换位置
    pub can_choose: bool,
    /// 自定义目录（如果设过）
    pub custom_dir: Option<String>,
    /// 可选位置：安卓是「私有 / 外部」两个，桌面是「默认 / 自定义」+ 自己选
    pub options: Vec<DirOption>,
}

/// 安卓 / iOS 的候选位置（单独拆出来，好在任何平台上单测）
///
/// SQLite 需要**真实路径**，而系统文件选择器（SAF）给的是 `content://` URI，给不了 SQLite。
/// 所以移动端只提供两个真路径：
/// - 应用私有目录 `/data/user/0/<pkg>/files`（默认，别的应用看不到）
/// - 应用外部目录 `getExternalFilesDir(Documents)`，落在共享存储的
///   `/storage/emulated/0/Android/data/<pkg>/files/Documents`，电脑用 USB 能看到
/// 只在移动端构建和测试里用到；桌面构建不需要它
#[allow(dead_code)]
pub fn mobile_dirs(private: &Path, external: Option<&Path>) -> Vec<DirOption> {
    let mut out = vec![DirOption {
        kind: "private",
        path: private.display().to_string(),
        label: "应用私有目录".into(),
        hint: "系统内部存储，其它应用看不到；卸载时一起删除".into(),
    }];
    if let Some(ext) = external.filter(|e| *e != private) {
        out.push(DirOption {
            kind: "external",
            path: ext.display().to_string(),
            label: "应用外部目录".into(),
            hint: "放在共享存储的 Android/data 下，电脑用 USB 能看到；卸载时也会删".into(),
        });
    }
    out
}

/// 桌面端的候选位置：默认目录 + 用户当前选的自定义目录（相同时不重复）
pub fn desktop_dirs(private: &Path, custom: Option<&Path>) -> Vec<DirOption> {
    let mut out = vec![DirOption {
        kind: "private",
        path: private.display().to_string(),
        label: "默认位置".into(),
        hint: "应用自己的数据目录；换系统或重装前先导出备份".into(),
    }];
    if let Some(custom) = custom.filter(|c| *c != private) {
        out.push(DirOption {
            kind: "custom",
            path: custom.display().to_string(),
            label: "自定义位置".into(),
            hint: "你自己选的目录，旧库仍保留在原位置".into(),
        });
    }
    out
}

pub fn candidate_dirs(
    private: &Path,
    external: Option<&Path>,
    custom: Option<&Path>,
) -> Vec<DirOption> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        let _ = custom;
        mobile_dirs(private, external)
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = external;
        desktop_dirs(private, custom)
    }
}

/// 目标目录能不能用。
///
/// 只要求是**绝对路径**：候选目录（私有 / 外部）和用户用系统文件夹选择器挑的目录都应该放行。
/// 真正能不能写由 `dir_writable` 实测，权限由 Android 的「所有文件访问」把关——
/// 早期版本在移动端只放行候选目录，结果「选择位置…」挑的文件夹会被自己拦掉。
pub fn dir_allowed(target: &Path, _candidates: &[DirOption]) -> bool {
    // 用 has_root 而不是 is_absolute：Windows 上 `/data/...` 这种「有根但没盘符」的路径
    // is_absolute 为 false，但我们和单测里都会碰到它
    target.has_root() && !target.as_os_str().is_empty()
}

pub fn config_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join(CONFIG_NAME))
        .map_err(|e| e.to_string())
}

/// 换位置前的检查结果
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareDir {
    /// 目标目录里已经有 notes.db 了吗（有就让用户决定要不要挪开）
    pub exists: bool,
    /// 快照应该写到哪里
    pub db_path: String,
    /// 旧库大小（没有就是 0）
    pub old_bytes: u64,
    /// 旧库的最后修改时间（毫秒时间戳；没有就是 None）
    pub old_modified: Option<u64>,
    /// 被挪开的旧库文件名（只在 force 时出现）
    pub moved_aside: Option<String>,
}

/// 把目录里已有的 notes.db 挪开（改名成 `.bak-<时间戳>`），交给用户留着。
///
/// 必须连 `-wal` / `-shm` 一起挪：只换主文件而留着旧的 WAL，SQLite 下次打开
/// 会把旧 WAL 应用到新库上，直接写坏数据。
pub fn move_existing_db_aside(dir: &Path, stamp: u64) -> std::io::Result<Option<String>> {
    let main = db_path(dir);
    if !main.exists() {
        return Ok(None);
    }
    let aside = format!("{}.bak-{stamp}", DB_NAME);
    std::fs::rename(&main, dir.join(&aside))?;
    for suffix in ["-wal", "-shm"] {
        let from = dir.join(format!("{DB_NAME}{suffix}"));
        if from.exists() {
            let _ = std::fs::rename(&from, dir.join(format!("{aside}{suffix}")));
        }
    }
    Ok(Some(aside))
}

/// 读配置：文件不在、读不了、JSON 坏了都返回默认值
pub fn read_config(app: &tauri::AppHandle) -> StorageConfig {
    let Ok(path) = config_file(app) else {
        return StorageConfig::default();
    };
    match std::fs::read_to_string(&path) {
        Ok(text) => StorageConfig::from_json(&text),
        Err(_) => StorageConfig::default(),
    }
}

pub fn write_config(app: &tauri::AppHandle, config: &StorageConfig) -> Result<(), String> {
    let path = config_file(app)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("建不了配置目录：{e}"))?;
    }
    std::fs::write(&path, config.to_json()).map_err(|e| format!("写不了配置：{e}"))
}

/// 配置里指的自定义目录（已解析成 PathBuf）
pub fn custom_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    read_config(app).dir()
}

pub fn db_path(dir: &Path) -> PathBuf {
    dir.join(DB_NAME)
}

/// 真的试写一次，别只看 create_dir_all 是否成功
pub fn dir_writable(dir: &Path) -> bool {
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

/// WAL 模式下未合并的数据在同名 `-wal` 里，算占用时一起算上
pub fn db_size(dir: &Path) -> u64 {
    ["", "-wal", "-shm"]
        .iter()
        .filter_map(|suffix| {
            let p = dir.join(format!("{DB_NAME}{suffix}"));
            std::fs::metadata(p).ok().map(|m| m.len())
        })
        .sum()
}

/// 文件名会以 `%` 或空格结尾的路径在安卓上是坑；这里只做最小校验
pub fn normalize_dir(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("目录不能是空字符串".into());
    }
    Ok(PathBuf::from(trimmed))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_dir(name: &str) -> PathBuf {
        // 不用 %TEMP%：本机安全软件会拦编译出来的新程序写临时目录
        let dir = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("test-tmp")
            .join(format!("storage-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn config_roundtrip() {
        let cfg = StorageConfig {
            data_dir: Some("D:\\麻雀记".into()),
        };
        let json = cfg.to_json();
        assert!(json.contains("麻雀记"));
        assert_eq!(StorageConfig::from_json(&json), cfg);
    }

    #[test]
    fn broken_config_falls_back_to_default() {
        assert_eq!(StorageConfig::from_json("{ 这不是 json"), StorageConfig::default());
        assert_eq!(StorageConfig::from_json("{}"), StorageConfig::default());
        // 多余字段不该让解析失败
        let cfg = StorageConfig::from_json(r#"{"data_dir":"/sdcard/x","future":1}"#);
        assert_eq!(cfg.data_dir.as_deref(), Some("/sdcard/x"));
    }

    #[test]
    fn db_size_counts_wal_and_shm() {
        let dir = tmp_dir("size");
        std::fs::write(dir.join(DB_NAME), vec![0u8; 100]).unwrap();
        std::fs::write(dir.join(format!("{DB_NAME}-wal")), vec![0u8; 50]).unwrap();
        std::fs::write(dir.join(format!("{DB_NAME}-shm")), vec![0u8; 25]).unwrap();
        assert_eq!(db_size(&dir), 175);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn db_size_missing_dir_is_zero() {
        let dir = tmp_dir("missing").join("nope");
        assert_eq!(db_size(&dir), 0);
    }

    #[test]
    fn dir_writable_probes_for_real() {
        let dir = tmp_dir("writable");
        assert!(dir_writable(&dir));
        // 探针文件用完就删，别留垃圾
        assert!(!dir.join(".write-probe").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn normalize_dir_rejects_blank() {
        assert!(normalize_dir("   ").is_err());
        assert_eq!(normalize_dir("  D:\\数据  ").unwrap(), PathBuf::from("D:\\数据"));
    }

    #[test]
    fn candidate_dirs_lists_private_and_external() {
        let private = PathBuf::from("/data/user/0/com.sparrow.note/files");
        let external = PathBuf::from("/storage/emulated/0/Android/data/com.sparrow.note/files/Documents");
        let options = mobile_dirs(&private, Some(&external));
        assert_eq!(options.len(), 2);
        assert_eq!(options[0].kind, "private");
        assert_eq!(options[1].kind, "external");
        assert_eq!(options[1].path, "/storage/emulated/0/Android/data/com.sparrow.note/files/Documents");
        assert!(!options[1].hint.is_empty());
    }

    #[test]
    fn mobile_dirs_without_external_has_one() {
        let private = PathBuf::from("/data/user/0/com.sparrow.note/files");
        assert_eq!(mobile_dirs(&private, None).len(), 1);
        // 外部目录和私有目录相同就不重复列
        assert_eq!(mobile_dirs(&private, Some(&private)).len(), 1);
    }

    #[test]
    fn desktop_dirs_lists_default_and_custom_once() {
        let private = PathBuf::from("/app/data");
        assert_eq!(desktop_dirs(&private, None).len(), 1);
        assert_eq!(desktop_dirs(&private, Some(&private)).len(), 1);
        let options = desktop_dirs(&private, Some(Path::new("/mnt/disk/笔记")));
        assert_eq!(options.len(), 2);
        assert_eq!(options[1].kind, "custom");
        assert_eq!(options[1].path, "/mnt/disk/笔记");
    }

    #[test]
    fn dir_allowed_requires_absolute_path() {
        let candidates = vec![DirOption {
            kind: "private",
            path: "/data/user/0/com.sparrow.note/files".into(),
            label: "应用私有目录".into(),
            hint: String::new(),
        }];
        // 候选目录、以及用户用系统选择器挑的任意绝对路径都放行
        assert!(dir_allowed(Path::new("/data/user/0/com.sparrow.note/files"), &candidates));
        assert!(dir_allowed(Path::new("/storage/emulated/0/Documents"), &candidates));
        // 相对路径不放行（防止把库写到进程当前目录这种莫名其妙的地方）
        assert!(!dir_allowed(Path::new("notes"), &candidates));
    }

    #[test]
    fn moving_existing_db_aside_keeps_wal_side_files() {
        let dir = tmp_dir("aside");
        std::fs::write(db_path(&dir), b"db").unwrap();
        std::fs::write(dir.join(format!("{DB_NAME}-wal")), b"wal").unwrap();
        std::fs::write(dir.join(format!("{DB_NAME}-shm")), b"shm").unwrap();

        let aside = move_existing_db_aside(&dir, 1700000000).unwrap().unwrap();
        assert_eq!(aside, "notes.db.bak-1700000000");
        assert!(!db_path(&dir).exists(), "主库应该被挪走，否则 VACUUM INTO 会失败");
        assert_eq!(std::fs::read(dir.join(&aside)).unwrap(), b"db");
        // WAL / SHM 一起挪，免得旧 WAL 被应用到新库上
        assert_eq!(std::fs::read(dir.join(format!("{aside}-wal"))).unwrap(), b"wal");
        assert_eq!(std::fs::read(dir.join(format!("{aside}-shm"))).unwrap(), b"shm");

        // 没有库时什么都不做
        assert_eq!(move_existing_db_aside(&dir, 1).unwrap(), None);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn config_dir_ignores_blank_and_trims() {
        assert_eq!(StorageConfig::default().dir(), None);
        let blank = StorageConfig { data_dir: Some("   ".into()) };
        assert_eq!(blank.dir(), None);
        let spaced = StorageConfig { data_dir: Some("  D:\\笔记  ".into()) };
        assert_eq!(spaced.dir(), Some(PathBuf::from("D:\\笔记")));
    }

    #[test]
    fn db_path_joins_expected_name() {
        assert!(db_path(Path::new("/data/app")).ends_with(DB_NAME));
    }
}
