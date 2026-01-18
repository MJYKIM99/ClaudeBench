use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};

// ========== Node Detection ==========

#[derive(Debug, Clone, Serialize)]
pub struct NodeInfo {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

/// Check common Node.js installation paths
fn find_node_path() -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_default();

    let paths = vec![
        format!("{home}/.local/bin/node"),
        "/opt/homebrew/bin/node".to_string(),           // Homebrew Apple Silicon
        "/usr/local/bin/node".to_string(),              // Homebrew Intel
        format!("{home}/.nvm/current/bin/node"),        // NVM
        format!("{home}/.volta/bin/node"),              // Volta
        format!("{home}/.fnm/aliases/default/bin/node"), // fnm
        format!("{home}/.bun/bin/node"),                // Bun
        "/usr/bin/node".to_string(),                    // System
    ];

    for path in paths {
        if std::path::Path::new(&path).exists() {
            return Some(path);
        }
    }

    // Try `which node` as fallback
    if let Ok(output) = Command::new("which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && std::path::Path::new(&path).exists() {
                return Some(path);
            }
        }
    }

    None
}

/// Get Node.js version from a given path
fn get_node_version(node_path: &str) -> Option<String> {
    if let Ok(output) = Command::new(node_path).arg("--version").output() {
        if output.status.success() {
            return Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
    }
    None
}

#[tauri::command]
fn detect_node() -> NodeInfo {
    match find_node_path() {
        Some(path) => {
            let version = get_node_version(&path);
            NodeInfo {
                found: true,
                path: Some(path),
                version,
                error: None,
            }
        }
        None => NodeInfo {
            found: false,
            path: None,
            version: None,
            error: Some("Node.js not found. Please install Node.js 18+".to_string()),
        },
    }
}

// ========== Sidecar Management ==========

// JSON-RPC types (reserved for future use)
#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: String,
    method: String,
    params: serde_json::Value,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcMessage {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<serde_json::Value>,
}

// Sidecar state now only holds stdin (stdout is moved to reader thread)
struct SidecarState {
    stdin: Option<ChildStdin>,
    child: Option<Child>,
    node_path: Option<String>,
    running: bool,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            stdin: None,
            child: None,
            node_path: None,
            running: false,
        }
    }
}

type SidecarMutex = Arc<Mutex<SidecarState>>;

#[tauri::command]
fn start_sidecar(state: State<'_, SidecarMutex>, app: tauri::AppHandle) -> Result<String, String> {
    // Check if already running
    {
        let sidecar = state.lock().map_err(|e| e.to_string())?;
        if sidecar.running {
            return Ok("Sidecar already running".to_string());
        }
    }

    // Find Node.js
    let node_path = find_node_path().ok_or("Node.js not found")?;

    // Get sidecar path from app resources
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("sidecar")
        .join("index.js");

    // Get project root by going up from exe directory (target/debug -> src-tauri -> project)
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    // Try to find sidecar in development location first (project_root/sidecar/dist/index.js)
    // This ensures node_modules is available for native modules like better-sqlite3
    let project_root = exe_dir.as_ref()
        .and_then(|p| p.parent()) // target
        .and_then(|p| p.parent()) // src-tauri
        .and_then(|p| p.parent()); // project root

    let dev_sidecar = project_root.map(|root| {
        let sidecar_js = root.join("sidecar").join("dist").join("index.js");
        let sidecar_cwd = root.join("sidecar");
        (sidecar_js, sidecar_cwd)
    });

    let (sidecar_path, sidecar_cwd) = if let Some((ref js_path, ref cwd_path)) = dev_sidecar {
        if js_path.exists() {
            (js_path.clone(), Some(cwd_path.clone()))
        } else if resource_path.exists() {
            (resource_path.clone(), None)
        } else {
            return Err(format!("Sidecar not found at {:?} or {:?}", js_path, resource_path));
        }
    } else if resource_path.exists() {
        (resource_path.clone(), None)
    } else {
        return Err(format!("Sidecar not found at {:?}", resource_path));
    };

    // Start sidecar process with correct working directory for node_modules resolution
    let mut cmd = Command::new(&node_path);
    cmd.arg(&sidecar_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(cwd) = sidecar_cwd {
        cmd.current_dir(cwd);
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to start sidecar: {}", e))?;

    // Take ownership of stdin and stdout
    let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    // Update state
    {
        let mut sidecar = state.lock().map_err(|e| e.to_string())?;
        sidecar.stdin = Some(stdin);
        sidecar.child = Some(child);
        sidecar.node_path = Some(node_path.clone());
        sidecar.running = true;
    }

    // Clone state for the reader threads
    let state_clone = Arc::clone(&state);

    // Spawn stdout reader thread
    let app_handle = app.app_handle().clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(content) => {
                    if !content.is_empty() {
                        let _ = app_handle.emit("sidecar-message", &content);
                    }
                }
                Err(e) => {
                    let _ = app_handle.emit("sidecar-error", format!("Read error: {}", e));
                    break;
                }
            }
        }

        // Mark as not running when stdout closes
        if let Ok(mut sidecar) = state_clone.lock() {
            sidecar.running = false;
        }
        let _ = app_handle.emit("sidecar-exit", ());
    });

    // Spawn stderr reader thread
    let app_handle_err = app.app_handle().clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(content) = line {
                if !content.is_empty() {
                    let _ = app_handle_err.emit("sidecar-stderr", &content);
                }
            }
        }
    });

    Ok(format!("Sidecar started with Node at {}", node_path))
}

#[tauri::command]
fn stop_sidecar(state: State<'_, SidecarMutex>) -> Result<String, String> {
    let mut sidecar = state.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = sidecar.child.take() {
        child.kill().map_err(|e| e.to_string())?;
        sidecar.stdin = None;
        sidecar.running = false;
        Ok("Sidecar stopped".to_string())
    } else {
        Ok("Sidecar was not running".to_string())
    }
}

#[tauri::command]
fn send_to_sidecar(state: State<'_, SidecarMutex>, message: String) -> Result<String, String> {
    let mut sidecar = state.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut stdin) = sidecar.stdin {
        writeln!(stdin, "{}", message).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        return Ok("Message sent".to_string());
    }

    Err("Sidecar not running or stdin not available".to_string())
}

// ========== App Entry ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(Mutex::new(SidecarState::default())))
        .invoke_handler(tauri::generate_handler![
            detect_node,
            start_sidecar,
            stop_sidecar,
            send_to_sidecar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
