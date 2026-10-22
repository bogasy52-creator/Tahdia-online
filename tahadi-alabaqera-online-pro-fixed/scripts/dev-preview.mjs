import {spawn} from 'node:child_process';

// Sites-style preview runners pass Vite's --strictPort flag. Wrangler already
// fails on an occupied port, so remove that one unsupported compatibility flag.
const args=process.argv.slice(2).filter((arg)=>arg!=='--strictPort').map(arg=>arg==='--host'?'--ip':arg.startsWith('--host=')?arg.replace('--host=','--ip='):arg);
const child=spawn('wrangler',['dev',...args],{stdio:'inherit',shell:process.platform==='win32'});

for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{
  if(signal)process.kill(process.pid,signal);
  else process.exit(code??0);
});
child.on('error',(error)=>{
  if(error.code!=='ENOENT'){console.error(error.message);process.exit(1);return;}
  const index=args.indexOf('--port'),port=index>=0?args[index+1]:process.env.PORT||'4173';
  console.log('Wrangler is not installed: opening the complete local games. Online rooms require npm ci.');
  const local=spawn(process.execPath,['scripts/play-local.mjs'],{stdio:'inherit',env:{...process.env,PORT:port}});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>local.kill(signal));
  local.on('exit',code=>process.exit(code??0));
});
