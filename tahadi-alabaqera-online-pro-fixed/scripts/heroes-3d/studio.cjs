const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const [,,jobsFile,outDir]=process.argv;
(async()=>{const jobs=JSON.parse(fs.readFileSync(jobsFile,'utf8'));fs.mkdirSync(outDir,{recursive:true});
 const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('file://'+path.resolve(__dirname,'studio.html'));await p.waitForFunction(()=>window.ready||false,null,{timeout:20000}).catch(()=>{});
 if(errs.length){console.log(errs.join('\n'));process.exit(1);}
 for(const job of jobs){const r=await p.evaluate(o=>window.renderSprite(o),job);fs.writeFileSync(path.join(outDir,job.name+'.png'),Buffer.from(r.url.split(',')[1],'base64'));console.log(job.name,Math.round(r.ms)+'ms');}
 if(errs.length)console.log(errs.join('\n'));await b.close();})();
