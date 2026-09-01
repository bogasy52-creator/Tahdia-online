import {spawn} from 'node:child_process';

// Sites-style preview runners pass Vite's --strictPort flag. Wrangler already
// fails on an occupied port, so remove that one unsupported compatibility flag.
const args=process.argv.slice(2).filter((arg)=>arg!=='--strictPort');
const child=spawn('wrangler',['dev',...args],{stdio:'inherit',shell:process.platform==='win32'});

for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{
  if(signal)process.kill(process.pid,signal);
  else process.exit(code??0);
});
child.on('error',(error)=>{
  console.error(error.message);
  process.exit(1);
});
