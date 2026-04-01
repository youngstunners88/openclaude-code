# OpenClaude Code

**Your own AI coding agent. Free models. Zero cost. Full control.**

## What Is This?

OpenClaude Code is a private, open-source AI coding assistant that runs on FREE models via OpenRouter. No subscription. No data sent to third parties. You own everything.

## Features

- 🤖 **Free AI models** — Nemotron 3 Super (120B), Llama 3.3 (70B), Gemma 3 (27B), and 25+ more
- 🔧 **10 tools** — File ops, shell commands, web fetch, git, memory, file listing
- 💾 **Persistent memory** — Agent remembers across sessions
- 🔒 **Security hardened** — Injection blocked, paths protected, input validated
- ⚡ **Zero cost** — All models are free tier on OpenRouter

## Quick Start

```bash
# Get a free OpenRouter key at https://openrouter.ai
export OPENROUTER_API_KEY="your-key-here"

# Ask it to do something
node src/index.js "Read my package.json and suggest improvements"

# Or use it programmatically
const { agent } = require('./src');
agent("Build me a landing page", process.env.OPENROUTER_API_KEY)
  .then(console.log);
```

## Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read any file from the filesystem |
| `write_file` | Write content to files (protected paths blocked) |
| `run_cmd` | Execute shell commands (injection blocked) |
| `web_fetch` | Fetch URL content |
| `git_status` | Check git status |
| `git_commit` | Stage and commit changes |
| `memory_save` | Save to persistent memory |
| `memory_load` | Load from persistent memory |
| `memory_search` | Search across all memories |
| `list_files` | List files in a directory |

## Free Models Available

28 free models via OpenRouter, including:
- NVIDIA Nemotron 3 Super 120B
- Meta Llama 3.3 70B
- Google Gemma 3 27B
- Nous Hermes 3 405B

## Security

- ✅ Protected paths blocked (/etc, /proc, /sys)
- ✅ Command injection blocked
- ✅ Pipe/backtick injection blocked
- ✅ Null parameter handling
- ✅ API key never exposed in repo

## Revenue Model

1. **Internal** — We use it for our own operations (free)
2. **SaaS** — Sell access to businesses ($29/month)
3. **White-label** — License to agencies ($199/month)
4. **API** — Pay-per-use via OpenRouter

## License

MIT
