# OpenClaude Code v2.1.2

🔒 **A secure, sandboxed AI coding agent powered by free models.**

> ⚠ **Security Notice**: This tool executes shell commands. While it includes a strict allowlist and path protection, never run it with root privileges.

## 🛡 Security Features

- **Command Allowlist**: Only safe commands (`ls`, `git`, `npm`) are permitted. Dangerous tools (`rm -rf`, `wget`, `python`) are blocked at the code level.
- **Path Protection**: Prevents writing to system directories (`/etc`, `/bin`) or sensitive user files (`.ssh`, `.bashrc`).
- **Isolated Memory**: Stores context in `~/.openclaude-code/memory`, keeping your project directory clean.
- **Input Sanitization**: Git commit messages and file paths are strictly validated against injection attacks.

## 🚀 Quick Start

1. **Get a Free Key**: Sign up at [OpenRouter.ai](https://openrouter.ai) and copy your API key.
2. **Set Environment Variable**:
```bash
export OPENROUTER_API_KEY="sk-or-v1-YOUR_KEY_HERE"
```
3. **Run**:
```bash
npm install
npm test   # Runs syntax check
npm start  # Starts the agent
```

## 🧪 Available Tools

- read_file, write_file, list_files
- run_cmd (Restricted allowlist)
- git_status, git_commit (Sanitized)
- web_fetch, memory_save, memory_load, memory_search
- brain_score (Placeholder for TRIBE v2)

## License

MIT
