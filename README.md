<p align="center">
  <img src="claudebenchicon.png" alt="ClaudeBench Logo" width="128" height="128">
</p>

<h1 align="center">ClaudeBench</h1>

<p align="center">
  <strong>Native macOS Desktop GUI for Claude Code</strong><br>
  Streamlined AI-powered coding with a beautiful, intuitive interface.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-blue?logo=apple&logoColor=white" alt="Platform">
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Claude-Agent%20SDK-D97757?logo=anthropic&logoColor=white" alt="Claude">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License">
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#中文">中文</a>
</p>

<p align="center">
  <img src="demo.gif" alt="ClaudeBench Demo" width="700">
</p>

---

## English

### Overview

ClaudeBench is a native desktop GUI for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Anthropic's official agentic coding tool. It provides a clean, intuitive interface for interacting with Claude's powerful AI capabilities, including code generation, file manipulation, and task automation.

### Features

| Feature | Description |
|---------|-------------|
| **Native macOS App** | Built with Tauri for blazing-fast, lightweight performance |
| **Session Persistence** | SQLite-powered storage keeps conversations across restarts |
| **Multiple Sessions** | Work on different projects with separate conversation threads |
| **Real-time Streaming** | Watch Claude's responses as they're generated |
| **Permission Control** | Interactive UI for tool permissions and user confirmations |
| **Settings Integration** | Auto-reads your `~/.claude/settings.json` configuration |
| **File Attachments** | Drag & drop files directly into conversations |

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| macOS | 10.15+ | Catalina or later |
| Node.js | 18+ | Required for building |
| Claude Code CLI | Latest | [Install Guide](https://docs.anthropic.com/en/docs/claude-code) |
| Rust | Latest | Development only |

### Installation

#### Build from Source

ClaudeBench is open source. You can build it yourself:

```bash
# Clone the repository
git clone https://github.com/MJYKIM99/ClaudeBench.git
cd ClaudeBench

# Install dependencies
npm install
cd sidecar && npm install && cd ..

# Build the sidecar
cd sidecar && npm run build && cd ..

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/macos/`.

### Configuration

ClaudeBench automatically reads your Claude Code config from `~/.claude/settings.json`:

| Setting | Description |
|---------|-------------|
| `ANTHROPIC_AUTH_TOKEN` | Your API authentication token |
| Model preferences | Claude model selection |
| Environment variables | Custom environment setup |

### Architecture

```
ClaudeBench/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── store/              # Zustand state management
│   └── types/              # TypeScript definitions
├── sidecar/                # Node.js sidecar process
│   └── src/
│       ├── index.ts        # Main sidecar entry
│       ├── session-store.ts # SQLite persistence
│       └── claude-settings.ts # Settings reader
└── src-tauri/              # Rust/Tauri backend
    └── src/
        └── lib.rs          # Tauri commands & sidecar mgmt
```

The application uses a three-layer architecture:

1. **Frontend (React)** - User interface and state management
2. **Sidecar (Node.js)** - Claude Agent SDK integration and session management
3. **Backend (Tauri/Rust)** - Native OS integration and process management

### Development

```bash
# Start dev server with hot reload
npm run tauri dev

# Type checking
npm run typecheck

# Production build
npm run tauri build
```

### Data Storage

| Data | Location | Format |
|------|----------|--------|
| Sessions | `~/.claude-gui/sessions.db` | SQLite |
| Settings | `~/.claude/settings.json` | JSON (shared with CLI) |

---

## 中文

### 概述

ClaudeBench 是一个原生 macOS 桌面应用，用于与 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（Anthropic 官方的智能编程工具）进行交互。它提供了一个简洁直观的界面，让你能够使用 Claude 强大的 AI 能力，包括代码生成、文件操作和任务自动化。

### 功能特性

| 功能 | 说明 |
|------|------|
| **原生 macOS 应用** | 使用 Tauri 构建，极致快速轻量 |
| **会话持久化** | SQLite 存储，重启后保留所有对话 |
| **多会话支持** | 不同项目独立对话，互不干扰 |
| **实时流式输出** | 即时查看 Claude 响应过程 |
| **权限控制** | 交互式 UI 管理工具权限 |
| **配置集成** | 自动读取 `~/.claude/settings.json` |
| **文件附件** | 拖放文件直接加入对话 |

### 系统要求

| 需求 | 版本 | 备注 |
|------|------|------|
| macOS | 10.15+ | Catalina 或更高 |
| Node.js | 18+ | 构建需要 |
| Claude Code CLI | 最新版 | [安装指南](https://docs.anthropic.com/en/docs/claude-code) |
| Rust | 最新版 | 仅开发需要 |

### 安装

#### 从源码编译

ClaudeBench 是开源项目，你可以自行编译：

```bash
# 克隆仓库
git clone https://github.com/MJYKIM99/ClaudeBench.git
cd ClaudeBench

# 安装依赖
npm install
cd sidecar && npm install && cd ..

# 编译 sidecar
cd sidecar && npm run build && cd ..

# 开发模式
npm run tauri dev

# 生产构建
npm run tauri build
```

编译完成后，应用位于 `src-tauri/target/release/bundle/macos/`。

### 开发

```bash
# 启动开发服务器（热重载）
npm run tauri dev

# 类型检查
npm run typecheck

# 生产构建
npm run tauri build
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **v0.1.2** | 2026-01-20 | Fix production build: Replace better-sqlite3 (native module) with sql.js (pure JS) for fully self-contained sidecar bundle; Bundle all dependencies including Claude Agent SDK |
| **v0.1.1** | 2026-01-19 | Skills system with real scanning from `~/.claude/skills` and project directories; Quick action shortcuts on welcome screen; Context menu for sessions (Open in Finder, Delete); Proper process cleanup on exit |
| **v0.1.0** | 2026-01-18 | Initial release - Native macOS GUI for Claude Code with session persistence, real-time streaming, and permission control |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache 2.0

## Acknowledgments

- [Anthropic](https://anthropic.com) - Claude and Agent SDK
- [Tauri](https://tauri.app) - Native app framework
