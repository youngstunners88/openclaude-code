#!/usr/bin/env node
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execFileSync } = require('child_process');
const memory = require('./memory');

const CONFIG = {
  openrouter: 'https://openrouter.ai/api/v1',
  defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 8192,
  turboQuantEnabled: process.env.TURBOQUANT_ENABLED === 'true',
  localBackend: process.env.LOCAL_BACKEND || null,
};

const SYSTEM_PROMPT = `You are OpenClaude Code — AI coding agent. Rules: 1) Plan before coding 2) Verify after 3) Be concise 4) Use tools`;

const openai = new OpenAI({
  baseURL: CONFIG.localBackend || CONFIG.openrouter,
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'OpenClaude Code' },
});

const tools = [
  { type: 'function', function: { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'run_cmd', description: 'Run command', parameters: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] } } },
  { type: 'function', function: { name: 'web_fetch', description: 'Fetch URL', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'git_status', description: 'Git status', parameters: { type: 'object', properties: { dir: { type: 'string' } } } } },
  { type: 'function', function: { name: 'git_commit', description: 'Git commit', parameters: { type: 'object', properties: { msg: { type: 'string' }, dir: { type: 'string' } }, required: ['msg'] } } },
  { type: 'function', function: { name: 'memory_save', description: 'Save to memory', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } } },
  { type: 'function', function: { name: 'memory_load', description: 'Load memory', parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } } },
  { type: 'function', function: { name: 'memory_search', description: 'Search memory', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'list_files', description: 'List files', parameters: { type: 'object', properties: { dir: { type: 'string' } } } } },
  { type: 'function', function: { name: 'brain_score', description: 'Score output quality', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] } } },
];

const toolHandlers = {
  read_file: async (p) => { try { if (!p.path || typeof p.path !== 'string') return { ok: false, err: 'Invalid path' }; return { ok: true, data: fs.readFileSync(path.resolve(p.path), 'utf8').substring(0, 8000) }; } catch (e) { return { ok: false, err: e.message }; } },
  write_file: async (p) => { try { if (!p.path || typeof p.path !== 'string') return { ok: false, err: 'Invalid path' }; const resolved = path.resolve(p.path); if (resolved.match(/^\/etc\/|^\/proc\/|^\/sys\//)) return { ok: false, err: 'Protected path' }; fs.mkdirSync(path.dirname(resolved), { recursive: true }); fs.writeFileSync(resolved, p.content); return { ok: true }; } catch (e) { return { ok: false, err: e.message }; } },
  run_cmd: async (p) => { try { if (!p.cmd || typeof p.cmd !== 'string') return { ok: false, err: 'Invalid command' }; return { ok: true, data: execFileSync('sh', ['-c', p.cmd], { timeout: 30000, maxBuffer: 1024 * 1024 }).toString().substring(0, 5000) }; } catch (e) { return { ok: false, err: e.message }; } },
  web_fetch: async (p) => { try { if (!p.url || typeof p.url !== 'string' || !p.url.startsWith('http')) return { ok: false, err: 'Invalid URL' }; return { ok: true, data: execFileSync('curl', ['-sL', p.url, '--max-time', '15'], { timeout: 20000 }).toString().substring(0, 5000) }; } catch (e) { return { ok: false, err: e.message }; } },
  git_status: async (p) => { try { return { ok: true, data: execFileSync('git', ['status'], { cwd: path.resolve(p.dir || '.'), timeout: 10000 }).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  git_commit: async (p) => { try { execFileSync('git', ['add', '.'], { cwd: path.resolve(p.dir || '.'), timeout: 10000 }); return { ok: true, data: execFileSync('git', ['commit', '-m', p.msg], { cwd: path.resolve(p.dir || '.'), timeout: 10000 }).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  memory_save: async (p) => { memory.save(p.key, p.value); return { ok: true }; },
  memory_load: async (p) => { return { ok: true, data: memory.load(p.key) }; },
  memory_search: async (p) => { return { ok: true, data: memory.search(p.query) }; },
  list_files: async (p) => { try { return { ok: true, data: execFileSync('ls', ['-la', path.resolve(p.dir || '.')], { timeout: 10000 }).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  brain_score: async (p) => {
    const input = p.input || '';
    let score = 50;
    if (input.includes('error') || input.includes('fail')) score -= 20;
    if (input.length > 100) score += 10;
    if (input.includes('success') || input.includes('ok')) score += 15;
    return { ok: true, data: { score: Math.min(100, Math.max(0, score)), note: 'Heuristic scoring (set HF_TOKEN for TRIBE v2)' } };
  },
};

async function agent(prompt) {
  if (!prompt?.trim()) return 'Provide a prompt.';
  if (!process.env.OPENROUTER_API_KEY) return 'OPENROUTER_API_KEY required. Get free key at openrouter.ai';

  const client = new OpenAI({
    baseURL: CONFIG.localBackend || CONFIG.openrouter,
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: { 'X-Title': 'OpenClaude Code' },
  });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  for (let i = 0; i < 12; i++) {
    try {
      const completion = await client.chat.completions.create({
        model: CONFIG.defaultModel,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: CONFIG.maxTokens,
      });
      const msg = completion.choices[0].message;
      messages.push(msg);

      if (msg.tool_calls) {
        for (const call of msg.tool_calls) {
          const fnName = call.function.name;
          const args = JSON.parse(call.function.arguments);
          const result = await toolHandlers[fnName](args);
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
        continue;
      }
      return msg.content;
    } catch (e) { return 'Error: ' + e.message; }
  }
  return 'Max iterations — break task into smaller steps.';
}

if (require.main === module) {
  const prompt = process.argv.slice(2).join(' ');
  agent(prompt).then(console.log).catch(console.error);
}

module.exports = { agent, tools: toolHandlers, testTribe: () => toolHandlers.brain_score({ input: 'console.log("test")' }) };
