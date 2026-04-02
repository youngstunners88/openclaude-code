# OpenClaude Code

**A secure tool execution engine for AI agents.**

OpenClaude Code is a backend library that gives AI coding agents (Claude Code, OpenClaw, Cursor, etc.) safe access to file operations, shell commands, web fetching, git, and persistent memory — all through a clean OpenAI-compatible API.

## What This Is

- A **tool execution layer** for AI agents
- A **backend service** that agents call to interact with the local environment
- A **secure sandbox** with command filtering and path validation

## What This Is NOT

- A standalone chatbot or IDE
- A replacement for Claude Code or Cursor
- A production-hardened system (prototype stage)

## Tools (8)

| Tool | Description | Security |
|------|-------------|----------|
| `read_file` | Read any file | Path validation, resolve() |
| `write_file` | Write to files | Protected paths blocked |
| `run_cmd` | Execute commands | Command allowlist (ls, cat, git, npm, etc.) |
| `web_fetch` | Fetch URL content | URL validation (http/https only) |
| `git_status` | Check git status | Working directory scoped |
| `git_commit` | Stage + commit | Working directory scoped |
| `list_files` | List directory | Path validation |
| `brain_score` | Score output quality | Heuristic (set HF_TOKEN for TRIBE v2) |

## For Claude Code Users

Add to your `.clauderc` or project config:
```json
{
  "mcpServers": {
    "openclaude": {
      "command": "node",
      "args": ["src/index.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-key"
      }
    }
  }
}
```

## Quick Start

```bash
npm install
export OPENROUTER_API_KEY="your-free-key-from-openrouter.ai"
node src/index.js "Read my package.json and list dependencies"
```

## Security Model

- ✅ Command allowlist (ls, cat, git, npm, node, curl, etc.)
- ✅ Protected paths blocked (/etc, /proc, /sys)
- ✅ URL validation for web_fetch
- ✅ Path validation with resolve()
- ❌ No sandboxing for file operations (planned)
- ❌ No rate limiting (planned)

## Free Models

28 free models via OpenRouter:
- NVIDIA Nemotron 3 Super 120B
- Meta Llama 3.3 70B
- Google Gemma 3 27B
- Nous Hermes 3 405B

## Known Limitations

- Command execution uses allowlist (not full sandbox)
- TRIBE v2 brain scoring uses heuristic (needs HF_TOKEN for real scoring)
- TurboQuant compression is planned, not implemented
- No automated tests yet

## License

MIT
