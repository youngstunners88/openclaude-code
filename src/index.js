// OpenClaude Code — AI Coding Agent with Free Models
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const memory = require('./memory');

const CONFIG = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 8192,
};

// Tools
const tools = {
  read_file: { desc: 'Read file', params: {path:'string'}, run: p => { try{return{ok:true,data:fs.readFileSync(p.path,'utf8').substring(0,5000)};}catch(e){return{ok:false,err:e.message};} }},
  write_file: { desc: 'Write file', params: {path:'string',content:'string'}, run: p => { try{if(p.path.match(/^\/etc\/|^\/proc\/|^\/sys\/|^\/dev\//))return{ok:false,err:'Protected path'};fs.mkdirSync(path.dirname(p.path),{recursive:true});fs.writeFileSync(p.path,p.content);return{ok:true};}catch(e){return{ok:false,err:e.message};} }},
  run_cmd: { desc: 'Run command', params: {cmd:'string'}, run: p => { try{if(p.cmd.match(/[;&|`$(){}]/))return{ok:false,err:'Dangerous characters blocked'};return{ok:true,data:execSync(p.cmd,{timeout:30000,shell:'/bin/sh'}).toString().substring(0,3000)};}catch(e){return{ok:false,err:e.message};} }},
  web_fetch: { desc: 'Fetch URL content', params: {url:'string'}, run: p => { try{const d=execSync('curl -sL "'+p.url.replace(/"/g,'')+'" --max-time 15',{timeout:20000}).toString();return{ok:true,data:d.substring(0,5000)};}catch(e){return{ok:false,err:e.message};} }},
  git_status: { desc: 'Git status', params: {dir:'string'}, run: p => { try{const d=execSync('cd '+(p.dir||'.')+' && git status',{timeout:10000}).toString();return{ok:true,data:d};}catch(e){return{ok:false,err:e.message};} }},
  git_commit: { desc: 'Git add+commit', params: {msg:'string',dir:'string'}, run: p => { try{const d=execSync('cd '+(p.dir||'.')+' && git add . && git commit -m "'+p.msg.replace(/"/g,'')+'"',{timeout:10000}).toString();return{ok:true,data:d};}catch(e){return{ok:false,err:e.message};} }},
  memory_save: { desc: 'Save to memory', params: {key:'string',value:'string'}, run: p => { try{memory.save(p.key,p.value);return{ok:true};}catch(e){return{ok:false,err:e.message};} }},
  memory_load: { desc: 'Load from memory', params: {key:'string'}, run: p => { try{const m=memory.load(p.key);return{ok:true,data:m};}catch(e){return{ok:false,err:e.message};} }},
  memory_search: { desc: 'Search memory', params: {query:'string'}, run: p => { try{const r=memory.search(p.query);return{ok:true,data:r};}catch(e){return{ok:false,err:e.message};} }},
  list_files: { desc: 'List files', params: {dir:'string'}, run: p => { try{const d=execSync('ls -la '+(p.dir||'.')).toString();return{ok:true,data:d};}catch(e){return{ok:false,err:e.message};} }},
};

async function llm(messages, key, model) {
  return new Promise((resolve,reject)=>{
    const b=JSON.stringify({model:model||CONFIG.defaultModel,messages,max_tokens:CONFIG.maxTokens});
    const r=https.request(CONFIG.openrouter,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'X-Title':'OpenClaude Code'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{const p=JSON.parse(d);resolve(p.choices[0].message);}catch(e){reject(e);}});});
    r.on('error',reject);r.write(b);r.end();
  });
}

async function agent(prompt, key, model) {
  if(!prompt||!prompt.trim())return 'Please provide a prompt.';
  if(!key)return 'API key required.';
  const msgs=[{role:'system',content:'You are OpenClaude Code, an expert coding agent. Rules: 1) Plan before coding 2) Verify after changes 3) Fix structural issues not just symptoms 4) Be concise 5) Tools: '+Object.entries(tools).map(([n,t])=>n+': '+t.desc).join(', ')},{role:'user',content:prompt}];
  for(let i=0;i<5;i++){
    try{
      const r=await llm(msgs,key,model);
      if(!r||!r.content)continue;
      const m=r.content.match(/tool\[(\w+)\]\s*(\{[^}]+\})/);
      if(m&&tools[m[1]]){const t=tools[m[1]].run(JSON.parse(m[2]));msgs.push({role:'assistant',content:r.content},{role:'user',content:'Result: '+JSON.stringify(t)});continue;}
      return r.content;
    }catch(e){return 'Error: '+e.message;}
  }
  return 'Max iterations';
}

if(require.main===module){const k=process.env.OPENROUTER_API_KEY;if(!k){console.log('Set OPENROUTER_API_KEY');process.exit(1);}agent(process.argv.slice(2).join(' '),k).then(console.log).catch(console.error);}
module.exports={agent,tools,llm};
