# OpenClaude Code

**Production-ready AI coding agent using free models via OpenRouter.**

## What This Is

A hardened, production-ready AI coding agent that runs on free models (Nemotron 3 Super, Llama 3.3, Qwen 2.5, Gemma 3). It can read/write files, run commands securely, fetch web content, and maintain memory across sessions.

## Features

- **11 Built-in Tools**: read_file, write_file, run_cmd, web_fetch, git_status, git_commit, memory_save, memory_load, memory_search, list_files, brain_score
- **Security Hardening**: Command denylist, protected path blocking, URL validation, input sanitization
- **Lazy Loading**: No module-level side effects - safe for testing and modular usage
- **Configuration Validation**: Startup checks for required environment variables
- **CLI Help System**: Built-in --help, --version, and --test commands
- **Persistent Memory**: JSON-based memory system with search capabilities
- **TRIBE v2 Brain Scoring**: Heuristic output quality scoring (upgradeable with HF_TOKEN)

## Quick Start

```bash
npm install
export OPENROUTER_API_KEY="your-free-key-from-openrouter.ai"
node src/index.js "Read my package.json"
```

## Usage

```bash
# Show help
node src/index.js --help

# Show version
node src/index.js --version

# Run self-test
node src/index.js --test

# Execute a prompt
node src/index.js "List files in current directory"
node src/index.js "Read my package.json and summarize it"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Get free key at [openrouter.ai](https://openrouter.ai) |
| `LOCAL_BACKEND` | No | Local inference backend URL (e.g., `http://localhost:8080/v1`) |
| `HF_TOKEN` | No | HuggingFace token for TRIBE v2 scoring |
| `MEMORY_DIR` | No | Custom memory directory path |
| `TURBOQUANT_ENABLED` | No | Enable TurboQuant compression (`true`/`false`) |

## Security Features

### Command Denylist
The following dangerous commands are blocked:
- `rm` on root (`/`), home (`~`, `$HOME`) directories
- `dd` (disk dump)
- `mkfs` (filesystem creation)
- `chmod 777` (dangerous permissions)
- `curl | sh` and `wget | sh` (pipe to shell)
- Chained `rm` commands via `;`, `&&`, `||`

### Protected Paths
Writes blocked to: `/etc`, `/proc`, `/sys`, `/dev`, hidden home directories

### URL Validation
- Localhost and private network URLs blocked
- URL format strictly validated

## API Usage

```javascript
const { agent, tools, validateConfig } = require('./src/index');

// Validate configuration first
const errors = validateConfig();
if (errors.length > 0) {
  console.error('Config errors:', errors);
}

// Use the agent
const result = await agent('List all JavaScript files in this directory');
console.log(result);
```

## Architecture

```
User Prompt → OpenRouter API → Agent Loop → Tool Execution → Response
                  ↓                              ↓
           Free Models                    Security Checks
         (Nemotron, Llama,                 (Denylist, Path
            Qwen, etc.)                      Validation)
```

## Known Limitations

- Command execution uses `sh -c` (necessary for complex commands) but is protected by denylist
- TRIBE v2 brain scoring uses heuristic fallback without HF_TOKEN
- No sandboxing for file operations beyond path validation
- No rate limiting (implement at API gateway level for SaaS deployments)

## Roadmap

- [ ] Add automated test suite (Jest/Mocha)
- [ ] Implement command allowlist mode
- [ ] Add structured logging (winston/pino)
- [ ] Implement rate limiting
- [ ] Add MCP (Model Context Protocol) support
- [ ] Docker containerization
- [ ] Web UI interface

## License

MIT
