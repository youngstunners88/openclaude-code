#!/usr/bin/env node
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// Memory (safe path, no cwd pollution)
const MEMORY_DIR = process.env.MEMORY_DIR || path.join(os.homedir(), '.openclaude-code', 'memory');
const memory = {
  save: (k, v) => {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    const file = path.join(MEMORY_DIR, k.replace(/[^a-z0-9_-]/gi, '_') + '.json');
    fs.writeFileSync(file, JSON.stringify({ key: k, value: v, timestamp: new Date().toISOString() }, null, 2));
  },
  load: (k) => {
    try { return JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, k.replace(/[^a-z0-9_-]/gi, '_') + '.json'), 'utf8')); } catch (e) { return null; }
  },
  search: (q) => {
    try {
      return fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json'))
        .map(f => { try { return JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, f), 'utf8')); } catch(e){ return null; } })
        .filter(m => m && JSON.stringify(m).toLowerCase().includes(q.toLowerCase()));
    } catch (e) { return []; }
  }
};

// Config
const CONFIG = {
  openrouter: 'https://openrouter.ai/api/v1',
  defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 8192,
  localBackend: process.env.LOCAL_BACKEND || null,
};

const SYSTEM_PROMPT = `You are OpenClaude Code — AI coding agent. Rules: 1) Plan before coding 2) Verify after 3) Be concise 4) Use tools`;

// Single lazy client
let _openai = null;
function getClient() {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: CONFIG.localBackend || CONFIG.openrouter,
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: { 'X-Title': 'OpenClaude Code' },
    });
  }
  return _openai;
}

// Security: Command allowlist
const ALLOWED_COMMANDS = ['ls', 'cat', 'git', 'npm', 'node', 'curl', 'echo', 'pwd', 'find', 'grep', 'mkdir', 'cp', 'mv', 'touch', 'rm', 'head', 'tail', 'wc', 'diff', 'sort', 'uniq'];

// Tool Definitions
const tools = [
  { type: 'function', function: { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'run_cmd', description: 'Run allowed shell command', parameters: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] } } },
  { type: 'function', function: { name: 'web_fetch', description: 'Fetch URL content', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'git_status', description: 'Git status', parameters: { type: 'object', properties: { dir: { type: 'string' } } } } },
  { type: 'function', function: { name: 'git_commit', description: 'Git add + commit', parameters: { type: 'object', properties: { msg: { type: 'string' }, dir: { type: 'string' } }, required: ['msg'] } } },
  { type: 'function', function: { name: 'memory_save', description: 'Save to memory', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } } },
  { type: 'function', function: { name: 'memory_load', description: 'Load from memory', parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } } },
  { type: 'function', function: { name: 'memory_search', description: 'Search memory', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'list_files', description: 'List directory', parameters: { type: 'object', properties: { dir: { type: 'string' } } } } },
  { type: 'function', function: { name: 'brain_score', description: 'Score output quality', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] } } },
];

// Tool Handlers
const toolHandlers = {
  read_file: async (p) => { try { if (!p.path || typeof p.path !== 'string') return { ok: false, err: 'Invalid path' }; return { ok: true, data: fs.readFileSync(path.resolve(p.path), 'utf8').substring(0, 8000) }; } catch (e) { return { ok: false, err: 'Read failed' }; } },
  write_file: async (p) => {
    try {
      if (!p.path || typeof p.path !== 'string') return { ok: false, err: 'Invalid path' };
      const resolved = path.resolve(p.path);
      const home = os.homedir();
      const BLOCKED = ['/etc/', '/proc/', '/sys/', '/root/', '/boot/', '/dev/', `${home}/.ssh`, `${home}/.bashrc`, `${home}/.bash_profile`, `${home}/.profile`, `${home}/.zshrc`, `${home}/.config/`, '/usr/bin/', '/usr/sbin/', '/bin/', '/sbin/'];
      if (BLOCKED.some(b => resolved.startsWith(b))) return { ok: false, err: 'Protected path' };
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, p.content);
      return { ok: true };
    } catch (e) { return { ok: false, err: 'Write failed' }; }
  },
  run_cmd: async (p) => {
    try {
      if (!p.cmd || typeof p.cmd !== 'string') return { ok: false, err: 'Invalid command' };
      const baseCmd = p.cmd.trim().split(/\s+/)[0];
      if (!ALLOWED_COMMANDS.includes(baseCmd)) return { ok: false, err: `Command '${baseCmd}' not allowed` };
      return { ok: true, data: execFileSync('sh', ['-c', p.cmd], { timeout: 30000, maxBuffer: 1024*1024 }).toString().substring(0, 5000) };
    } catch (e) { return { ok: false, err: 'Command failed' }; }
  },
  web_fetch: async (p) => {
    try {
      if (!p.url || typeof p.url !== 'string' || !p.url.match(/^https?:\/\//)) return { ok: false, err: 'Invalid URL' };
      return { ok: true, data: execFileSync('curl', ['-sL', p.url, '--max-time', '15']).toString().substring(0, 5000) };
    } catch (e) { return { ok: false, err: 'Fetch failed' }; }
  },
  git_status: async (p) => { try { return { ok: true, data: execFileSync('git', ['status'], { cwd: path.resolve(p.dir||'.') }).toString() }; } catch (e) { return { ok: false, err: 'Git failed' }; } },
  git_commit: async (p) => {
    try {
      const safeMsg = (p.msg || 'update').replace(/[^a-zA-Z0-9 ._-]/g, '').substring(0, 72);
      execFileSync('git', ['add', '.'], { cwd: path.resolve(p.dir||'.') });
      return { ok: true, data: execFileSync('git', ['commit', '-m', safeMsg], { cwd: path.resolve(p.dir||'.') }).toString() };
    } catch (e) { return { ok: false, err: 'Commit failed' }; }
  },
  memory_save: async (p) => { memory.save(p.key, p.value); return { ok: true }; },
  memory_load: async (p) => { return { ok: true, data: memory.load(p.key) }; },
  memory_search: async (p) => { return { ok: true, data: memory.search(p.query) }; },
  list_files: async (p) => { try { return { ok: true, data: execFileSync('ls', ['-la', path.resolve(p.dir||'.')]).toString() }; } catch (e) { return { ok: false, err: 'List failed' }; } },
  brain_score: async (p) => { return { ok: true, data: { score: null, note: 'Set HF_TOKEN for real scoring' } }; }
};

// Agent Loop
async function agent(prompt) {
  if (!prompt?.trim()) return 'Provide a prompt.';
  if (!process.env.OPENROUTER_API_KEY) return 'OPENROUTER_API_KEY required.';
  const client = getClient();
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }];
  for (let i = 0; i < 12; i++) {
    try {
      const completion = await client.chat.completions.create({ model: CONFIG.defaultModel, messages, tools, tool_choice: 'auto', max_tokens: CONFIG.maxTokens });
      const msg = completion.choices[0].message;
      messages.push(msg);
      if (msg.tool_calls) {
        for (const call of msg.tool_calls) {
          const fn = call.function.name;
          if (!toolHandlers[fn]) { messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ ok: false, err: 'Unknown tool' }) }); continue; }
          const args = JSON.parse(call.function.arguments);
          const result = await toolHandlers[fn](args);
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
      } else { return msg.content; }
    } catch (e) { return `Error: ${e.message}`; }
  }
  return 'Max iterations reached.';
}

if (require.main === module) { agent(process.argv.slice(2).join(' ')).then(console.log).catch(console.error); }
module.exports = { agent };
