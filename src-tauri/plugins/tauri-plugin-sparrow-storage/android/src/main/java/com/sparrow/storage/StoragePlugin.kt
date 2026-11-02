package com.sparrow.storage

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.Settings
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

/**
 * 系统文件夹选择 + 「所有文件访问」授权。
 *
 * 选完把 SAF 的树 URI 换算成真实路径（`primary:Documents/麻雀记` → `/storage/emulated/0/Documents/麻雀记`），
 * 因为 SQLite 只认真实路径；换算不出来的（比如云盘、下载 provider）返回空串，让界面提示换一个目录。
 */
@TauriPlugin
class StoragePlugin(private val activity: Activity) : Plugin(activity) {

  @Command
  fun pickFolder(invoke: Invoke) {
    activity.runOnUiThread {
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
      }
      startActivityForResult(invoke, intent, "onFolderPicked")
    }
  }

  @ActivityCallback
  fun onFolderPicked(invoke: Invoke, result: ActivityResult) {
    if (result.resultCode != Activity.RESULT_OK) {
      invoke.reject("cancelled")
      return
    }
    val uri: Uri? = result.data?.data
    if (uri == null) {
      invoke.reject("没有拿到目录")
      return
    }
    try {
      activity.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      )
    } catch (_: SecurityException) {
      // 有些 provider 不支持持久化授权，能选就能用，不阻塞
    }

    val res = JSObject()
    res.put("uri", uri.toString())
    res.put("path", treeUriToPath(uri) ?: "")
    res.put("allFiles", hasAllFilesAccess())
    invoke.resolve(res)
  }

  @Command
  fun storageAccess(invoke: Invoke) {
    val res = JSObject()
    res.put("allFiles", hasAllFilesAccess())
    invoke.resolve(res)
  }

  @Command
  fun requestStorageAccess(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager()) {
      activity.runOnUiThread {
        try {
          activity.startActivity(
            Intent(
              Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
              Uri.parse("package:${activity.packageName}")
            )
          )
        } catch (_: Exception) {
          // 个别系统没有「单个应用」的入口，退到总列表
          activity.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
        }
      }
    }
    invoke.resolve(JSObject())
  }

  private fun hasAllFilesAccess(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager() else true

  /**
   * `content://com.android.externalstorage.documents/tree/primary%3ADocuments%2F麻雀记`
   * → `/storage/emulated/0/Documents/麻雀记`；`1234-5678:笔记` → `/storage/1234-5678/笔记`。
   * 非 externalstorage provider（云盘、下载 provider）返回 null。
   */
  private fun treeUriToPath(uri: Uri): String? {
    if (uri.authority != "com.android.externalstorage.documents") return null
    val treeId = try {
      DocumentsContract.getTreeDocumentId(uri)
    } catch (_: Exception) {
      return null
    }
    val idx = treeId.indexOf(':')
    val volume = if (idx >= 0) treeId.substring(0, idx) else "primary"
    val rel = if (idx >= 0) treeId.substring(idx + 1) else treeId
    val base = when (volume) {
      "primary" -> Environment.getExternalStorageDirectory().absolutePath
      "home" -> return null
      else -> "/storage/$volume"
    }
    return if (rel.isEmpty()) base else "$base/$rel"
  }
}
