# OpenClaude Code — Our Own AI Coding Agent

## Vision
Build our own AI coding agent that uses FREE models via OpenRouter, has the full tool system of Claude Code, and runs compressed via TurboQuant.

## Sources
1. **Claude Code source** (extracted from zip) — full implementation reference
2. **free-code** — stripped version, telemetry removed, experimental features enabled
3. **claw-code** — Rust rewrite patterns
4. **claude-md** — production-grade directives
5. **claude-code-system-prompts** — reconstructed patterns
6. **TurboQuant** — KV cache compression (run larger models on less hardware)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE                        │
│              Terminal / Web / API                        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  OPENROUTER GATEWAY                      │
│     Nemotron 3 Super | Qwen 2.5 | Mistral | Llama       │
│            FREE models via OpenRouter API                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│               TURBOQUANT COMPRESSOR                      │
│     KV cache compression (4.6-6.4x)                     │
│     Run 70B models on 16GB RAM                          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                  AGENT ENGINE                            │
│     Tool system (from Claude Code patterns)             │
│     Context management (from claude-md)                 │
│     Plugin system (from source code)                    │
│     Memory system (from our fabric)                     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                     TOOLS                                │
│     File ops | Bash | Web search | Browser | MCP        │
│     Trading | Website builder | Voice | Video           │
└─────────────────────────────────────────────────────────┘
```

## Revenue Model
1. **Internal use** — we use it for our own operations (free)
2. **SaaS** — sell access to businesses ($29/month)
3. **White-label** — license to other agencies ($199/month)
4. **API access** — sell compute via API (pay per use)

## Free Models via OpenRouter
- Nemotron 3 Super (free)
- Qwen 2.5 72B (free)
- Mistral 7B (free)
- Llama 3.1 70B (free)
- DeepSeek Coder (free)
- CodeLlama 34B (free)

## Compression (TurboQuant)
- 2-bit: 6.4x compression
- 3-bit: 4.6x compression
- 4-bit: 3.8x compression
- Run 70B model on 16GB RAM
- Run 13B model on 4GB RAM
