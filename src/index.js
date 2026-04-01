const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const memory = require('./memory');

const CONFIG = {
  openrouter: 'https://openrouter.ai/api/v1',
  defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 8192,
  turboQuantEnabled: process.env.TURBOQUANT_ENABLED === 'true',
  localBackend: process.env.LOCAL_BACKEND || null,
};

// Command security: denylist patterns to block dangerous operations
const COMMAND_DENYLIST = [
  /^rm\s+(-[rf]+\s+)?(\/|~|\$HOME)/i,
  /^dd\s+/i,
  /^mkfs/i,
  /^chmod\s+777/i,
  /^curl.*\|\s*(ba)?sh/i,
  /^wget.*\|\s*(ba)?sh/i,
  /;\s*rm\s/i,
  /\|\|\s*rm\s/i,
  /&&\s*rm\s/i,
];

const SYSTEM_PROMPT = `You are OpenClaude Code — AI coding agent. Rules: 1) Plan before coding 2) Verify after 3) Be concise 4) Use tools`;

// Lazy client initialization
let _client = null;

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: CONFIG.localBackend || CONFIG.openrouter,
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: { 'X-Title': 'OpenClaude Code' },
    });
  }
  return _client;
}

// Validate configuration on startup
function validateConfig() {
  const errors = [];
  if (!process.env.OPENROUTER_API_KEY && !CONFIG.localBackend) {
    errors.push('OPENROUTER_API_KEY environment variable is required (or set LOCAL_BACKEND for local inference)');
  }
  if (CONFIG.localBackend && !CONFIG.localBackend.startsWith('http')) {
    errors.push('LOCAL_BACKEND must be a valid HTTP URL');
  }
  return errors;
}

const tools = [
  { type: 'function', function: { name: 'read_file', description: 'Read file contents', parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path to read' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Write content to file', parameters: { type: 'object', properties: { path: { type: 'string', description: 'File path to write' }, content: { type: 'string', description: 'Content to write' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'run_cmd', description: 'Run shell command', parameters: { type: 'object', properties: { cmd: { type: 'string', description: 'Command to execute' } }, required: ['cmd'] } } },
  { type: 'function', function: { name: 'web_fetch', description: 'Fetch URL content', parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL to fetch (http/https)' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'git_status', description: 'Get git status', parameters: { type: 'object', properties: { dir: { type: 'string', description: 'Directory path' } } } } },
  { type: 'function', function: { name: 'git_commit', description: 'Commit git changes', parameters: { type: 'object', properties: { msg: { type: 'string', description: 'Commit message' }, dir: { type: 'string', description: 'Directory path' } }, required: ['msg'] } } },
  { type: 'function', function: { name: 'memory_save', description: 'Save to persistent memory', parameters: { type: 'object', properties: { key: { type: 'string', description: 'Memory key' }, value: { type: 'string', description: 'Value to save' } }, required: ['key', 'value'] } } },
  { type: 'function', function: { name: 'memory_load', description: 'Load from memory', parameters: { type: 'object', properties: { key: { type: 'string', description: 'Memory key' } }, required: ['key'] } } },
  { type: 'function', function: { name: 'memory_search', description: 'Search memory', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'list_files', description: 'List directory contents', parameters: { type: 'object', properties: { dir: { type: 'string', description: 'Directory path' } } } } },
  { type: 'function', function: { name: 'brain_score', description: 'Score output quality (TRIBE v2)', parameters: { type: 'object', properties: { input: { type: 'string', description: 'Output to score' } }, required: ['input'] } } },
];

const toolHandlers = {
  read_file: async (p) => {
    try {
      if (!p.path || typeof p.path !== 'string') {
        return { ok: false, err: 'Invalid path parameter' };
      }
      const resolved = path.resolve(p.path);
      if (!fs.existsSync(resolved)) {
        return { ok: false, err: 'File does not exist' };
      }
      const stats = fs.statSync(resolved);
      if (!stats.isFile()) {
        return { ok: false, err: 'Path is not a file' };
      }
      const content = fs.readFileSync(resolved, 'utf8');
      return { ok: true, data: content.substring(0, 8000) };
    } catch (e) {
      console.error('[read_file] Error:', e.message);
      return { ok: false, err: e.message };
    }
  },

  write_file: async (p) => {
    try {
      if (!p.path || typeof p.path !== 'string') {
        return { ok: false, err: 'Invalid path parameter' };
      }
      if (typeof p.content !== 'string') {
        return { ok: false, err: 'Content must be a string' };
      }
      const resolved = path.resolve(p.path);
      if (resolved.match(/^\/etc\/|^\/proc\/|^\/sys\/|^\/dev\//)) {
        return { ok: false, err: 'Protected path blocked for security' };
      }
      if (resolved === os.homedir() || resolved.startsWith(os.homedir() + '/.')) {
        return { ok: false, err: 'Cannot write to hidden home directories' };
      }
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, p.content, 'utf8');
      return { ok: true, data: `Written ${p.content.length} bytes to ${resolved}` };
    } catch (e) {
      console.error('[write_file] Error:', e.message);
      return { ok: false, err: e.message };
    }
  },

  run_cmd: async (p) => {
    try {
      if (!p.cmd || typeof p.cmd !== 'string') {
        return { ok: false, err: 'Invalid command parameter' };
      }
      for (const pattern of COMMAND_DENYLIST) {
        if (pattern.test(p.cmd)) {
          console.warn('[run_cmd] Blocked dangerous command:', p.cmd);
          return { ok: false, err: 'Command blocked by security policy' };
        }
      }
      const result = execFileSync('sh', ['-c', p.cmd], {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, HOME: os.homedir() },
      }).toString();
      return { ok: true, data: result.substring(0, 5000) };
    } catch (e) {
      const errorMsg = e.message || e.stderr?.toString() || 'Unknown error';
      console.error('[run_cmd] Error:', errorMsg);
      return { ok: false, err: errorMsg.substring(0, 500) };
    }
  },

  web_fetch: async (p) => {
    try {
      if (!p.url || typeof p.url !== 'string' || !p.url.startsWith('http')) {
        return { ok: false, err: 'Invalid URL - must start with http:// or https://' };
      }
      let urlObj;
      try {
        urlObj = new URL(p.url);
      } catch (e) {
        return { ok: false, err: 'Invalid URL format' };
      }
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return { ok: false, err: 'Cannot fetch localhost URLs' };
      }
      if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname)) {
        return { ok: false, err: 'Cannot fetch private network URLs' };
      }
      const result = execFileSync('curl', [
        '-sL', p.url,
        '--max-time', '15',
        '--connect-timeout', '10',
        '-A', 'OpenClaude-Code/1.0',
      ], {
        timeout: 20000,
        maxBuffer: 512 * 1024,
      }).toString();
      return { ok: true, data: result.substring(0, 5000) };
    } catch (e) {
      const errorMsg = e.message || e.stderr?.toString() || 'Unknown error';
      console.error('[web_fetch] Error:', errorMsg);
      return { ok: false, err: errorMsg.substring(0, 500) };
    }
  },

  git_status: async (p) => {
    try {
      const dir = p.dir ? path.resolve(p.dir) : process.cwd();
      if (!fs.existsSync(dir)) {
        return { ok: false, err: 'Directory does not exist' };
      }
      const result = execFileSync('git', ['status'], {
        cwd: dir,
        timeout: 10000,
        encoding: 'utf8',
      });
      return { ok: true, data: result };
    } catch (e) {
      const errorMsg = e.message || e.stderr?.toString() || 'Unknown error';
      console.error('[git_status] Error:', errorMsg);
      return { ok: false, err: errorMsg.substring(0, 500) };
    }
  },

  git_commit: async (p) => {
    try {
      if (!p.msg || typeof p.msg !== 'string') {
        return { ok: false, err: 'Commit message required' };
      }
      const dir = p.dir ? path.resolve(p.dir) : process.cwd();
      if (!fs.existsSync(dir)) {
        return { ok: false, err: 'Directory does not exist' };
      }
      execFileSync('git', ['add', '.'], { cwd: dir, timeout: 10000, encoding: 'utf8' });
      const result = execFileSync('git', ['commit', '-m', p.msg], {
        cwd: dir,
        timeout: 10000,
        encoding: 'utf8',
      });
      return { ok: true, data: result };
    } catch (e) {
      const errorMsg = e.message || e.stderr?.toString() || 'Unknown error';
      console.error('[git_commit] Error:', errorMsg);
      return { ok: false, err: errorMsg.substring(0, 500) };
    }
  },

  memory_save: async (p) => {
    try {
      if (!p.key || typeof p.key !== 'string') {
        return { ok: false, err: 'Memory key required' };
      }
      if (p.value === undefined) {
        return { ok: false, err: 'Memory value required' };
      }
      memory.save(p.key, String(p.value));
      return { ok: true, data: `Saved memory: ${p.key}` };
    } catch (e) {
      console.error('[memory_save] Error:', e.message);
      return { ok: false, err: e.message };
    }
  },

  memory_load: async (p) => {
    try {
      if (!p.key || typeof p.key !== 'string') {
        return { ok: false, err: 'Memory key required' };
      }
      const result = memory.load(p.key);
      return { ok: true, data: result !== null ? result : 'Key not found' };
    } catch (e) {
      console.error('[memory_load] Error:', e.message);
      return { ok: false, err: e.message };
    }
  },

  memory_search: async (p) => {
    try {
      if (!p.query || typeof p.query !== 'string') {
        return { ok: false, err: 'Search query required' };
      }
      const results = memory.search(p.query);
      return { ok: true, data: results.length > 0 ? results : 'No matches found' };
    } catch (e) {
      console.error('[memory_search] Error:', e.message);
      return { ok: false, err: e.message };
    }
  },

  list_files: async (p) => {
    try {
      const dir = p.dir ? path.resolve(p.dir) : process.cwd();
      if (!fs.existsSync(dir)) {
        return { ok: false, err: 'Directory does not exist' };
      }
      const stats = fs.statSync(dir);
      if (!stats.isDirectory()) {
        return { ok: false, err: 'Path is not a directory' };
      }
      const result = execFileSync('ls', ['-la', dir], {
        timeout: 10000,
        encoding: 'utf8',
      });
      return { ok: true, data: result };
    } catch (e) {
      const errorMsg = e.message || e.stderr?.toString() || 'Unknown error';
      console.error('[list_files] Error:', errorMsg);
      return { ok: false, err: errorMsg.substring(0, 500) };
    }
  },

  brain_score: async (p) => {
    try {
      const input = p.input || '';
      let score = 50;
      let notes = [];

      if (input.toLowerCase().includes('error') || input.toLowerCase().includes('fail')) {
        score -= 20;
        notes.push('Detected error/failure keywords');
      }
      if (input.length > 100) {
        score += 10;
        notes.push('Substantial output length');
      }
      if (input.toLowerCase().includes('success') || input.toLowerCase().includes('ok')) {
        score += 15;
        notes.push('Detected success keywords');
      }
      if (input.includes('//') || input.includes('#')) {
        score += 5;
        notes.push('Contains comments/documentation');
      }

      const finalScore = Math.min(100, Math.max(0, score));
      return {
        ok: true,
        data: {
          score: finalScore,
          note: process.env.HF_TOKEN
            ? 'TRIBE v2 scoring active'
            : 'Heuristic scoring (set HF_TOKEN for TRIBE v2)',
          details: notes,
        },
      };
    } catch (e) {
      console.error('[brain_score] Error:', e.message);
      return { ok: false, err: e.message };
    }
  },
};

async function agent(prompt) {
  if (!prompt?.trim()) return 'Provide a prompt.';
  
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    return configErrors.join('. ');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  for (let i = 0; i < 12; i++) {
    try {
      const client = getClient();
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
    } catch (e) {
      console.error('[agent] Error:', e.message);
      return 'Error: ' + e.message;
    }
  }
  return 'Max iterations reached — break task into smaller steps.';
}

function showHelp() {
  console.log(`
OpenClaude Code - AI Coding Agent

Usage:
  node src/index.js [options] <prompt>

Options:
  --help, -h     Show this help message
  --version, -v  Show version number
  --test         Run self-test

Examples:
  node src/index.js "Read my package.json"
  node src/index.js "List files in current directory"
  node src/index.js --test

Environment Variables:
  OPENROUTER_API_KEY  Required: Get free key at openrouter.ai
  LOCAL_BACKEND       Optional: Local inference backend URL
  HF_TOKEN           Optional: HuggingFace token for TRIBE v2 scoring
  MEMORY_DIR         Optional: Custom memory directory
`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    const pkg = require('../package.json');
    console.log(`OpenClaude Code v${pkg.version}`);
    process.exit(0);
  }
  
  if (args.includes('--test')) {
    console.log('Running self-test...');
    const testResult = toolHandlers.brain_score({ input: 'console.log("test")' });
    console.log('Brain score test:', testResult);
    console.log('Self-test complete.');
    process.exit(0);
  }
  
  const prompt = args.filter(a => !a.startsWith('--')).join(' ');
  agent(prompt).then(console.log).catch(console.error);
}

module.exports = { agent, tools: toolHandlers, testTribe: () => toolHandlers.brain_score({ input: 'console.log("test")' }), validateConfig, getConfig: () => CONFIG };
