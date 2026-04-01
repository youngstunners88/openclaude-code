const OpenAI = require('openai');
const { HfInference } = require('@huggingface/inference');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const memory = require('./memory');

const CONFIG = {
  openrouter: 'https://openrouter.ai/api/v1',
  defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 8192,
  hfToken: process.env.HF_TOKEN,
  turboQuantEnabled: process.env.TURBOQUANT_ENABLED === "true",
  localBackend: process.env.LOCAL_BACKEND || null,
};

const CLAUDE_OVERRIDES = fs.existsSync(path.join(__dirname, '../CLAUDE.md'))
  ? fs.readFileSync(path.join(__dirname, '../CLAUDE.md'), 'utf8')
  : 'Phased execution. Senior Dev Override. Sub-Agent Swarming. Context Decay awareness.';

const SYSTEM_PROMPT = `You are OpenClaude Code — autonomous senior-dev coding agent.
${CLAUDE_OVERRIDES}
Leonxlnx ULTRAPLAN active: Break tasks into phases. Output plan until user says go. Brain-align via TRIBE v2. Rules: 1) Plan before coding 2) Verify after changes 3) Fix structural issues 4) Be concise 5) Use tools`;

const openai = new OpenAI({
  baseURL: CONFIG.localBackend || CONFIG.openrouter,
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  defaultHeaders: { 'X-Title': 'OpenClaude Code' },
});

const tools = [
  { type: 'function', function: { name: 'read_file', description: 'Read file content', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Write/overwrite file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'run_cmd', description: 'Run shell command', parameters: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] } } },
  { type: 'function', function: { name: 'web_fetch', description: 'Fetch URL content', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'git_status', description: 'Git status', parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'git_commit', description: 'Git commit', parameters: { type: 'object', properties: { msg: { type: 'string' }, dir: { type: 'string' } }, required: ['msg'] } } },
  { type: 'function', function: { name: 'memory_save', description: 'Save to memory', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } } },
  { type: 'function', function: { name: 'memory_load', description: 'Load from memory', parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } } },
  { type: 'function', function: { name: 'memory_search', description: 'Search memory', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'list_files', description: 'List files in dir', parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'brain_score', description: 'TRIBE v2 brain prediction — scores cognitive engagement', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] } } },
];

const toolHandlers = {
  read_file: async (p) => { try { return { ok: true, data: fs.readFileSync(p.path, 'utf8').substring(0, 8000) }; } catch (e) { return { ok: false, err: e.message }; } },
  write_file: async (p) => { try { if (p.path.match(/^\/etc\/|^\/proc\/|^\/sys\//)) return { ok: false, err: 'Protected' }; fs.mkdirSync(path.dirname(p.path), { recursive: true }); fs.writeFileSync(p.path, p.content); return { ok: true }; } catch (e) { return { ok: false, err: e.message }; } },
  run_cmd: async (p) => { try { if (p.cmd.match(/[;&|`$(){}]/)) return { ok: false, err: 'Blocked' }; return { ok: true, data: execSync(p.cmd, { timeout: 30000 }).toString().substring(0, 5000) }; } catch (e) { return { ok: false, err: e.message }; } },
  web_fetch: async (p) => { try { return { ok: true, data: execSync('curl -sL "' + p.url.replace(/"/g, '') + '" --max-time 15', { timeout: 20000 }).toString().substring(0, 5000) }; } catch (e) { return { ok: false, err: e.message }; } },
  git_status: async (p) => { try { return { ok: true, data: execSync('cd ' + (p.dir || '.') + ' && git status', { timeout: 10000 }).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  git_commit: async (p) => { try { return { ok: true, data: execSync('cd ' + (p.dir || '.') + ' && git add . && git commit -m "' + p.msg.replace(/"/g, '') + '"', { timeout: 10000 }).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  memory_save: async (p) => { memory.save(p.key, p.value); return { ok: true }; },
  memory_load: async (p) => { return { ok: true, data: memory.load(p.key) }; },
  memory_search: async (p) => { return { ok: true, data: memory.search(p.query) }; },
  list_files: async (p) => { try { return { ok: true, data: execSync('ls -la ' + (p.dir || '.')).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  brain_score: async (p) => {
    if (!CONFIG.hfToken) {
      // Fallback scoring
      const input = p.input || '';
      let score = 50;
      if (input.includes('error') || input.includes('fail')) score -= 20;
      if (input.length > 100) score += 10;
      if (input.includes('success') || input.includes('ok')) score += 15;
      return { ok: true, data: { score: Math.min(100, Math.max(0, score)), insight: 'Fallback scoring' } };
    }
    try {
      const hf = new HfInference(CONFIG.hfToken);
      const result = await hf.textGeneration({
        model: 'facebook/tribev2',
        inputs: `Score human engagement (0-100) for: ${p.input.substring(0, 500)}`,
        parameters: { max_new_tokens: 50, temperature: 0.3 }
      });
      return { ok: true, data: { score: result.generated_text, insight: 'TRIBE v2 scored' } };
    } catch (e) {
      return { ok: false, err: 'TRIBE error: ' + e.message };
    }
  },
};

async function getClient() {
  if (CONFIG.turboQuantEnabled && CONFIG.localBackend) {
    console.log('TurboQuant backend active');
    return new OpenAI({ baseURL: CONFIG.localBackend, apiKey: 'lm-studio' });
  }
  return openai;
}

async function agent(prompt, apiKey) {
  if (!prompt?.trim()) return 'Provide a prompt.';
  if (!apiKey && !process.env.OPENROUTER_API_KEY) return 'OPENROUTER_API_KEY required.';

  const client = await getClient();
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

          if (['write_file', 'run_cmd', 'git_commit'].includes(fnName)) {
            const brain = await toolHandlers.brain_score({ input: JSON.stringify(result) });
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ ...result, brainScore: brain.data }) });
          } else {
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
          }
        }
        continue;
      }

      return msg.content;
    } catch (e) { return 'Error: ' + e.message; }
  }
  return 'Max iterations — break task down.';
}

if (require.main === module) {
  const prompt = process.argv.slice(2).join(' ');
  agent(prompt).then(console.log).catch(console.error);
}

module.exports = { agent, tools: toolHandlers, testTribe: () => toolHandlers.brain_score({ input: 'console.log("hello")' }) };
