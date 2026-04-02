// Safe command execution with allowlist
const { execFileSync } = require('child_process');

const ALLOWED_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find', 'echo',
  'git', 'npm', 'node', 'python3', 'curl', 'mkdir', 'cp', 'mv',
  'pwd', 'date', 'whoami', 'uname', 'df', 'du', 'ps', 'wc',
]);

function safeExec(cmd) {
  if (!cmd || typeof cmd !== 'string') return { ok: false, err: 'Invalid command' };
  
  // Extract first word
  const firstWord = cmd.trim().split(/\s+/)[0];
  
  // Check allowlist
  if (!ALLOWED_COMMANDS.has(firstWord)) {
    return { ok: false, err: `Command '${firstWord}' not allowed. Allowed: ${[...ALLOWED_COMMANDS].join(', ')}` };
  }
  
  // Block dangerous patterns
  if (cmd.match(/[;&|`$(){}\\<>]/)) {
    return { ok: false, err: 'Dangerous characters blocked' };
  }
  
  try {
    return { ok: true, data: execFile(firstWord, cmd.trim().split(/\s+/).slice(1), { timeout: 30000 }).toString().substring(0, 5000) };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

module.exports = { safeExec, ALLOWED_COMMANDS };
