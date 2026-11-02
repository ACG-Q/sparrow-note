const COMMANDS: &[&str] = &["pick_folder", "storage_access", "request_storage_access"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .try_build()
        .unwrap();
}
