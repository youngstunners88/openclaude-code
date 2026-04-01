// Persistent Memory System for OpenClaude Code
const fs = require('fs');
const path = require('path');

const MEMORY_DIR = process.env.MEMORY_DIR || '/root/.openclaw/workspace/openclaude-code/memory';

// Save memory entry
function save(key, value) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const file = path.join(MEMORY_DIR, key.replace(/[^a-z0-9_-]/gi, '_') + '.json');
  const entry = { key, value, timestamp: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(entry, null, 2));
  return entry;
}

// Load memory entry
function load(key) {
  const file = path.join(MEMORY_DIR, key.replace(/[^a-z0-9_-]/gi, '_') + '.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}

// List all memories
function list() {
  try {
    return fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, f), 'utf8')));
  } catch (e) { return []; }
}

// Search memories
function search(query) {
  return list().filter(m => {
    const text = JSON.stringify(m).toLowerCase();
    return text.includes(query.toLowerCase());
  });
}

module.exports = { save, load, list, search };
