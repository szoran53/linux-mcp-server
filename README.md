# linux-mcp-server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for managing Ubuntu/Linux systems. Gives AI assistants like Claude direct access to system information, processes, services, files, logs, and package management — either on the local machine or a remote host via SSH.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)

---

## What is this?

MCP is an open standard that lets AI assistants use tools — structured actions they can call to read data and take actions on real systems. Instead of copy-pasting terminal output into a chat window, an MCP server lets the AI query your system directly and act on what it finds.

`linux-mcp-server` exposes your Linux system as a set of MCP tools. You can point it at the machine it's running on (local mode) or at a remote host over SSH. Run one instance per host you want to manage.

**Practical example:** Rather than asking "how do I check if nginx is running?", your AI assistant can just check, see that it's failed, read the journal logs, and restart it — all without you copying a single line of output.

---

## Features

| Category | Tools |
|---|---|
| **Shell** | Run arbitrary commands, run with sudo |
| **System** | Hostname/OS info, CPU usage, memory usage, disk usage, network interfaces |
| **Processes** | List processes, get process details, top CPU/memory consumers, kill process |
| **Services** | List systemd services, status, start, stop, restart, enable, disable |
| **Files** | Read, write, list directory, file info, create directory, delete |
| **Logs** | Journal logs (with filters), tail log files, search journal by pattern |
| **Packages** | List installed, search, show details, install, remove, apt update, upgrade |

---

## Quick Start

### Option 1 — Clone and build

```bash
git clone https://github.com/szoran53/linux-mcp-server.git
cd linux-mcp-server
npm install
npm run build
```

The built binary is at `dist/index.js`. You can also run it via:

```bash
node dist/index.js
```

### Option 2 — Global install from source

```bash
npm install -g .
linux-mcp-server
```

---

## Configuration

All configuration is via environment variables.

### Core

| Variable | Default | Description |
|---|---|---|
| `LOCAL_MODE` | `false` | Set to `true` to manage the local machine directly (no SSH) |
| `TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_HTTP_PORT` | `3300` | HTTP port (when `TRANSPORT=http`) |
| `MCP_HTTP_HOST` | `127.0.0.1` | HTTP bind address (when `TRANSPORT=http`) |
| `COMMAND_TIMEOUT_MS` | `30000` | Max time (ms) for any single command |
| `LOG_PATHS` | `/var/log` | Comma-separated list of allowed log file path prefixes |

### SSH mode only

| Variable | Required | Default | Description |
|---|---|---|---|
| `SSH_HOST` | Yes | — | Remote host IP or hostname |
| `SSH_USER` | Yes | — | SSH username |
| `SSH_PORT` | No | `22` | SSH port |
| `SSH_KEY_PATH` | No | `~/.ssh/id_rsa` | Path to private key |
| `SSH_STRICT_HOST_CHECK` | No | `true` | Set to `false` to skip host key verification |

### Sudo

| Variable | Description |
|---|---|
| `SUDO_PASSWORD` | Optional. Provide if the SSH user requires a password for sudo. Not needed if the user has passwordless sudo. |

---

## Modes

### Local mode

Runs on the machine you want to manage. Commands execute directly — no SSH involved. Ideal for running as a systemd service on each host.

```bash
LOCAL_MODE=true TRANSPORT=http MCP_HTTP_PORT=3300 node dist/index.js
```

### SSH mode

Connects to a remote host over SSH. Run the server anywhere (your workstation, a management box) and point it at a target.

```bash
SSH_HOST=192.168.1.50 \
SSH_USER=admin \
SSH_KEY_PATH=~/.ssh/id_ed25519 \
TRANSPORT=http \
MCP_HTTP_PORT=3301 \
node dist/index.js
```

Run multiple instances on different ports to manage multiple hosts simultaneously.

---

## Running as a systemd service

The recommended approach for homelab use is a systemd **user** service — it runs under your user account, starts on boot, and restarts automatically.

### 1. Create the service file

Copy the example from the repo:

```bash
mkdir -p ~/.config/systemd/user
cp examples/mcp-linux-local.service ~/.config/systemd/user/
```

Or create `~/.config/systemd/user/mcp-linux-local.service`:

```ini
[Unit]
Description=Linux MCP Server (local - this machine)
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/linux-mcp-server
Restart=always
RestartSec=5

Environment=LOCAL_MODE=true
Environment=TRANSPORT=http
Environment=MCP_HTTP_PORT=3300
Environment=MCP_HTTP_HOST=127.0.0.1

[Install]
WantedBy=default.target
```

Update `ExecStart` to match where your binary is (`which linux-mcp-server`).

### 2. Enable and start

```bash
systemctl --user daemon-reload
systemctl --user enable mcp-linux-local.service
systemctl --user start mcp-linux-local.service
systemctl --user status mcp-linux-local.service
```

### 3. Enable linger (survive logout/reboot)

User services stop when you log out unless linger is enabled:

```bash
loginctl enable-linger $USER
```

### Verify

```bash
curl http://localhost:3300/health
# {"status":"ok","server":"linux-mcp-server","version":"0.1.0"}
```

---

## Connecting to Claude Code

[Claude Code](https://claude.ai/code) is Anthropic's CLI for Claude. MCP servers are configured in `~/.claude.json` (global) or per-project.

### HTTP transport (recommended for persistent servers)

Add to `~/.claude.json` under `mcpServers` at the global level, or under `projects["/your/project"].mcpServers` for project scope:

```json
{
  "mcpServers": {
    "linux-local": {
      "type": "http",
      "url": "http://localhost:3300/mcp"
    }
  }
}
```

For a remote host running in SSH mode on port 3301:

```json
{
  "mcpServers": {
    "linux-local": {
      "type": "http",
      "url": "http://localhost:3300/mcp"
    },
    "linux-myserver": {
      "type": "http",
      "url": "http://localhost:3301/mcp"
    }
  }
}
```

### stdio transport

If you prefer stdio (no persistent process), use the `claude mcp add` command:

```bash
# Local mode
claude mcp add linux-local \
  -e LOCAL_MODE=true \
  -- node /path/to/linux-mcp-server/dist/index.js

# SSH mode
claude mcp add linux-myserver \
  -e SSH_HOST=192.168.1.50 \
  -e SSH_USER=admin \
  -e SSH_KEY_PATH=~/.ssh/id_ed25519 \
  -- node /path/to/linux-mcp-server/dist/index.js
```

### Verify in Claude Code

```
/mcp
```

You should see `linux-local` (or your server name) listed as connected.

---

## Other MCP Clients

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "linux-local": {
      "command": "node",
      "args": ["/path/to/linux-mcp-server/dist/index.js"],
      "env": {
        "LOCAL_MODE": "true"
      }
    }
  }
}
```

### Cline (VS Code)

In VS Code settings (`cline.mcpServers`):

```json
{
  "linux-local": {
    "command": "node",
    "args": ["/path/to/linux-mcp-server/dist/index.js"],
    "env": {
      "LOCAL_MODE": "true"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "linux-local": {
      "command": "node",
      "args": ["/path/to/linux-mcp-server/dist/index.js"],
      "env": {
        "LOCAL_MODE": "true"
      }
    }
  }
}
```

### Continue.dev

Add to `~/.continue/config.json` under `experimental.modelContextProtocolServers`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/path/to/linux-mcp-server/dist/index.js"],
          "env": {
            "LOCAL_MODE": "true"
          }
        }
      }
    ]
  }
}
```

---

## Tool Reference

### Shell

| Tool | Description |
|---|---|
| `run_command` | Execute an arbitrary shell command. 30s timeout, 1MB output limit. |
| `run_command_sudo` | Execute a shell command with sudo. Same limits. |

### System

| Tool | Description |
|---|---|
| `get_system_info` | Hostname, OS version, kernel, uptime, architecture. |
| `get_cpu_usage` | Load averages, core count, top process snapshot. |
| `get_memory_usage` | RAM and swap usage. |
| `get_disk_usage` | Disk usage per mount point and block device layout. |
| `get_network_interfaces` | All interfaces with IPs and link state. |

### Processes

| Tool | Description |
|---|---|
| `list_processes` | List running processes (ps aux), sortable by cpu/memory/pid. Returns top 60. |
| `get_process` | Get details for a specific process by PID or name. |
| `get_top_processes` | Top N processes by CPU or memory. |
| `kill_process` | Send a signal to a process by PID. Default SIGTERM, use SIGKILL to force. |

### Services

| Tool | Description |
|---|---|
| `service_list` | List systemd services. Filter by scope (system/user) and state. |
| `service_status` | Get systemctl status for a service. |
| `service_start` | Start a system service (sudo). |
| `service_stop` | Stop a system service (sudo). |
| `service_restart` | Restart a system service (sudo). |
| `service_enable` | Enable a service to start at boot (sudo). |
| `service_disable` | Disable a service from starting at boot (sudo). |

### Files

| Tool | Description |
|---|---|
| `read_file` | Read file contents. 1MB limit. |
| `write_file` | Write text to a file (create or overwrite). |
| `list_directory` | List directory contents (ls -la). |
| `get_file_info` | File metadata: permissions, owner, size, timestamps. |
| `make_directory` | Create a directory (mkdir -p). |
| `delete_file` | Delete a file or directory. Set recursive=true for non-empty dirs. |

### Logs

| Tool | Description |
|---|---|
| `get_journal_logs` | Fetch systemd journal logs with filters (unit, since/until, lines, priority). |
| `tail_file` | Tail a log file. Path must be under an allowed prefix (default: /var/log). |
| `search_logs` | Search journal logs for a pattern. Optional unit filter. Returns last 200 matches. |

### Packages (apt)

| Tool | Description |
|---|---|
| `apt_list_installed` | List installed packages. Optional name filter. |
| `apt_search` | Search available packages by name or description. |
| `apt_show` | Show detailed package information. |
| `apt_install` | Install one or more packages (sudo). |
| `apt_remove` | Remove packages, leaving config files (sudo). |
| `apt_update` | Run apt-get update to refresh package index (sudo). |
| `apt_upgrade` | Upgrade installed packages (sudo). Supports dry_run=true. |

---

## Roadmap

- [ ] npm publish
- [ ] SSH multi-host: multiple named SSH targets in a single server instance
- [ ] ZFS module: pool status, scrub, snapshot management
- [ ] GPU host support: nvidia-smi integration for CUDA hosts
- [ ] README in other languages

---

## Contributing

PRs welcome. The codebase is straightforward TypeScript — each tool category is a self-contained module in `src/tools/`. Tests use Vitest.

```bash
npm test
```

---

## License

MIT
