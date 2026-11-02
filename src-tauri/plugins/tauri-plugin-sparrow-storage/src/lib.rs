//! 安卓上的「选数据目录」。
//!
//! 为什么不用 tauri-plugin-dialog：它在移动端直接返回 `FolderPickerNotImplemented`。
//! 这里给三样东西：
//!
//! - `pick_folder`：`ACTION_OPEN_DOCUMENT_TREE` 选文件夹，并把 `content://` 的树 URI
//!   换算成真实路径（`primary:Documents/麻雀记` → `/storage/emulated/0/Documents/麻雀记`）
//! - `storage_access`：查「所有文件访问」权限（`MANAGE_EXTERNAL_STORAGE`）是否给了
//! - `request_storage_access`：跳到系统的授权页
//!
//! 为什么要「所有文件访问」：SQLite 得用真实路径打开数据库文件，而安卓 11 起
//! 想写任意共享存储路径就必须有这个权限（SAF 的 `content://` 给不了 SQLite 用）。
//! 没授权时也不是不能用——退回应用外部目录即可，界面上会说清楚。
//!
//! iOS 上这套东西不成立：没有 SAF，也拿不到「任意目录的真实路径」。
//! 所以所有平台门控都用 `target_os = "android"`，**不要用 `cfg(mobile)`**——
//! 否则给 iOS 编译时会去调 `register_android_plugin`，编译直接失败。

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime,
};
#[cfg(target_os = "android")]
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderInfo {
    /// SAF 的树 URI（留档用；SQLite 用不了它）
    pub uri: String,
    /// 换算出来的真实路径；不是存储卡/内部存储里的目录时为空串
    pub path: String,
    /// 是否已经拿到「所有文件访问」
    pub all_files: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessInfo {
    pub all_files: bool,
}

#[cfg(target_os = "android")]
struct StorageHandle<R: Runtime>(tauri::plugin::PluginHandle<R>);

/// 选一个目录。只有安卓支持；其它平台请用系统自带的目录选择器。
#[tauri::command]
async fn pick_folder<R: Runtime>(app: AppHandle<R>) -> Result<FolderInfo, String> {
    #[cfg(target_os = "android")]
    {
        let handle = app.state::<StorageHandle<R>>().0.clone();
        return tauri::async_runtime::spawn_blocking(move || {
            handle
                .run_mobile_plugin::<FolderInfo>("pickFolder", ())
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err(if cfg!(target_os = "ios") {
            "iOS 上不能把数据放到任意目录：请用「导出备份」把数据带走"
        } else {
            "桌面端请用系统目录选择器"
        }
        .into())
    }
}

/// 查「所有文件访问」是否已授权（只有安卓有这个概念，其它平台恒为 true）
#[tauri::command]
async fn storage_access<R: Runtime>(app: AppHandle<R>) -> Result<AccessInfo, String> {
    #[cfg(target_os = "android")]
    {
        let handle = app.state::<StorageHandle<R>>().0.clone();
        return tauri::async_runtime::spawn_blocking(move || {
            handle
                .run_mobile_plugin::<AccessInfo>("storageAccess", ())
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(AccessInfo { all_files: true })
    }
}

/// 跳到系统设置里的「所有文件访问」页面（仅安卓）
#[tauri::command]
async fn request_storage_access<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let handle = app.state::<StorageHandle<R>>().0.clone();
        return tauri::async_runtime::spawn_blocking(move || {
            handle
                .run_mobile_plugin::<serde_json::Value>("requestStorageAccess", ())
                .map(|_| ())
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("sparrow-storage")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin("com.sparrow.storage", "StoragePlugin")?;
                app.manage(StorageHandle(handle));
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = (app, api);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            storage_access,
            request_storage_access
        ])
        .build()
}
