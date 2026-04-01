// OpenClaude Code — AI Coding Agent with Free Models
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  defaultModel: 'nousresearch/hermes-3-llama-3.1-405b:free',
  maxTokens: 4096,
};

// Tools
const tools = {
  read_file: { desc: 'Read file', params: {path:'string'}, run: p => { try{return{ok:true,data:fs.readFileSync(p.path,'utf8').substring(0,5000)};}catch(e){return{ok:false,err:e.message};} }},
  write_file: { desc: 'Write file', params: {path:'string',content:'string'}, run: p => { try{fs.mkdirSync(path.dirname(p.path),{recursive:true});fs.writeFileSync(p.path,p.content);return{ok:true};}catch(e){return{ok:false,err:e.message};} }},
  run_cmd: { desc: 'Run command', params: {cmd:'string'}, run: p => { try{return{ok:true,data:execSync(p.cmd,{timeout:30000}).toString().substring(0,3000)};}catch(e){return{ok:false,err:e.message};} }},
};

async function llm(messages, key, model) {
  return new Promise((resolve,reject)=>{
    const b=JSON.stringify({model:model||CONFIG.defaultModel,messages,max_tokens:CONFIG.maxTokens});
    const r=https.request(CONFIG.openrouter,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'X-Title':'OpenClaude Code'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{const p=JSON.parse(d);resolve(p.choices[0].message);}catch(e){reject(e);}});});
    r.on('error',reject);r.write(b);r.end();
  });
}

async function agent(prompt, key, model) {
  const msgs=[{role:'system',content:'You are OpenClaude Code. Be concise. Tools: '+Object.entries(tools).map(([n,t])=>n+': '+t.desc).join(', ')},{role:'user',content:prompt}];
  for(let i=0;i<5;i++){
    const r=await llm(msgs,key,model);
    const m=r.content.match(/tool\[(\w+)\]\s*(\{[^}]+\})/);
    if(m&&tools[m[1]]){const t=tools[m[1]].run(JSON.parse(m[2]));msgs.push({role:'assistant',content:r.content},{role:'user',content:'Result: '+JSON.stringify(t)});continue;}
    return r.content;
  }
  return 'Max iterations';
}

if(require.main===module){const k=process.env.OPENROUTER_API_KEY;if(!k){console.log('Set OPENROUTER_API_KEY');process.exit(1);}agent(process.argv.slice(2).join(' '),k).then(console.log).catch(console.error);}
module.exports={agent,tools,llm};
