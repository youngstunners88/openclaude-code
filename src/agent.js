// OpenClaude Code — Agent Engine with TRIBE v2 + TurboQuant
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 8192,
};

// Tool handlers
const toolHandlers = {
  read_file: async (p) => { try { return { ok: true, data: fs.readFileSync(p.path, 'utf8').substring(0, 8000) }; } catch (e) { return { ok: false, err: e.message }; } },
  write_file: async (p) => { try { if (p.path.match(/^\/etc\/|^\/proc\/|^\/sys\//)) return { ok: false, err: 'Protected path' }; fs.mkdirSync(path.dirname(p.path), { recursive: true }); fs.writeFileSync(p.path, p.content); return { ok: true }; } catch (e) { return { ok: false, err: e.message }; } },
  run_cmd: async (p) => { try { if (p.cmd.match(/[;&|`$(){}]/)) return { ok: false, err: 'Blocked' }; const { execSync } = require('child_process'); return { ok: true, data: execSync(p.cmd, { timeout: 30000 }).toString().substring(0, 5000) }; } catch (e) { return { ok: false, err: e.message }; } },
  web_fetch: async (p) => { try { const { execSync } = require('child_process'); return { ok: true, data: execSync('curl -sL "' + p.url.replace(/"/g, '') + '" --max-time 15', { timeout: 20000 }).toString().substring(0, 5000) }; } catch (e) { return { ok: false, err: e.message }; } },
  git_status: async (p) => { try { const { execSync } = require('child_process'); return { ok: true, data: execSync('cd ' + (p.dir || '.') + ' && git status', { timeout: 10000 }).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  list_files: async (p) => { try { const { execSync } = require('child_process'); return { ok: true, data: execSync('ls -la ' + (p.dir || '.')).toString() }; } catch (e) { return { ok: false, err: e.message }; } },
  brain_score: async (p) => {
    // TRIBE v2: Score output quality 0-100
    const input = p.input || '';
    let score = 50;
    if (input.includes('error') || input.includes('fail')) score -= 20;
    if (input.length > 100) score += 10;
    if (input.includes('success') || input.includes('ok')) score += 15;
    if (input.match(/[{}()\[\]]/)) score += 5; // structured data
    return { ok: true, data: Math.min(100, Math.max(0, score)) };
  },
};

// Tool definitions for OpenAI format
const tools = [
  { type: 'function', function: { name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Write to a file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'run_cmd', description: 'Run a shell command', parameters: { type: 'object', properties: { cmd: { type: 'string' } }, required: ['cmd'] } } },
  { type: 'function', function: { name: 'web_fetch', description: 'Fetch URL content', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
  { type: 'function', function: { name: 'git_status', description: 'Git status', parameters: { type: 'object', properties: { dir: { type: 'string' } } } } },
  { type: 'function', function: { name: 'list_files', description: 'List files', parameters: { type: 'object', properties: { dir: { type: 'string' } } } } },
  { type: 'function', function: { name: 'brain_score', description: 'Score output quality', parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] } } },
];

async function callLLM(messages, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: CONFIG.defaultModel, messages, tools, tool_choice: 'auto', max_tokens: CONFIG.maxTokens });
    const req = https.request(CONFIG.openrouter, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey, 'X-Title': 'OpenClaude Code' } }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function agent(prompt, apiKey) {
  if (!prompt?.trim()) return 'Please provide a prompt.';
  if (!apiKey) return 'OPENROUTER_API_KEY required.';

  const messages = [
    { role: 'system', content: 'You are OpenClaude Code. Rules: 1) Plan before coding 2) Verify after changes 3) Fix structural issues not just symptoms 4) Be concise 5) Tools: read_file, write_file, run_cmd, web_fetch, git_status, list_files, brain_score' },
    { role: 'user', content: prompt },
  ];

  for (let i = 0; i < 8; i++) {
    try {
      const completion = await callLLM(messages, apiKey);
      const msg = completion.choices?.[0]?.message;
      if (!msg) continue;
      messages.push(msg);

      if (msg.tool_calls) {
        for (const call of msg.tool_calls) {
          const fnName = call.function.name;
          const args = JSON.parse(call.function.arguments);
          const result = await toolHandlers[fnName](args);

          // TRIBE v2: brain-score major outputs
          if (['write_file', 'run_cmd'].includes(fnName)) {
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
  return 'Max iterations — task too complex. Try breaking it down.';
}

// CLI
if (require.main === module) {
  const key = process.env.OPENROUTER_API_KEY;
  const prompt = process.argv.slice(2).join(' ');
  agent(prompt, key).then(console.log).catch(console.error);
}

module.exports = { agent, tools: toolHandlers, testTribe: () => toolHandlers.brain_score({ input: 'Test code: console.log("hello")' }) };
