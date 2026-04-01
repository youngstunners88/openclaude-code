const fs = require('fs');
const path = require('path');
const os = require('os');

const MEMORY_DIR = process.env.MEMORY_DIR || path.join(os.homedir(), '.openclaude-code', 'memory');

function save(key, value) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const file = path.join(MEMORY_DIR, key.replace(/[^a-z0-9_-]/gi, '_') + '.json');
  fs.writeFileSync(file, JSON.stringify({ key, value, timestamp: new Date().toISOString() }, null, 2));
}

function load(key) {
  try { return JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, key.replace(/[^a-z0-9_-]/gi, '_') + '.json'), 'utf8')); }
  catch (e) { return null; }
}

function search(query) {
  try {
    return fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, f), 'utf8'))).filter(m => JSON.stringify(m).toLowerCase().includes(query.toLowerCase()));
  } catch (e) { return []; }
}

module.exports = { save, load, search };
