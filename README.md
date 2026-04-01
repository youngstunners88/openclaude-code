# OpenClaude Code

**AI coding agent using free models via OpenRouter. Prototype stage.**

## What This Is

A working prototype AI coding agent that runs on free models (Nemotron 3 Super, Llama 3.3, Gemma 3). It can read/write files, run commands, fetch web content, and maintain memory across sessions.

## What This Is NOT

- Not a replacement for Claude Code or Cursor
- Not production-hardened (security needs work)
- Not a full IDE — it's a CLI agent

## Setup

```bash
npm install
export OPENROUTER_API_KEY="your-free-key-from-openrouter.ai"
node src/index.js "Read my package.json"
```

## Tools (11)

read_file, write_file, run_cmd, web_fetch, git_status, git_commit, memory_save, memory_load, memory_search, list_files, brain_score

## Known Issues

- Command execution needs sandboxing (currently string-filtered)
- TRIBE v2 brain scoring uses fallback (needs HF_TOKEN for real scoring)
- No automated tests yet
- TurboQuant is planned, not implemented

## Status

Working prototype. Not production-ready. Good foundation for further development.

## License

MIT
