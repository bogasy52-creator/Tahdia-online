import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'tahdia-generated-css-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'scripts'));
 await writeFile(join(root,'package.json'),JSON.stringify({version:'30.0.0'}));
 await mkdir(join(root,'public/assets/css'),{recursive:true});
 await copyFile(fileURLToPath(new URL('../scripts/build-styles.mjs',import.meta.url)),join(root,'scripts/build-styles.mjs'));
 const manifest={'serpent.html':['assets/css/serpent.css'],'sudoku.html':['assets/css/sudoku.css']};
 await writeFile(join(root,'scripts/style-bundles.json'),JSON.stringify(manifest,null,2)+'\n');
 for(const page of ['serpent','sudoku']){
  await writeFile(join(root,'public',page+'.html'),`<!doctype html><html><head><title>${page}</title><link rel="stylesheet" href="assets/css/app-${page}.css?v=23.0.1"></head><body></body></html>`);
  await writeFile(join(root,'public/assets/css',page+'.css'),`.${page}{color:green}\n`);
  await writeFile(join(root,'public/assets/css',`app-${page}.css`),`/* user compiled ${page} CSS */\n`);
 }
 await writeFile(join(root,'public/assets/css/design-system.css'),':root{color-scheme:dark}\n');
 const run=(...args)=>spawnSync(process.execPath,['scripts/build-styles.mjs',...args],{cwd:root,encoding:'utf8'});
 return {root,run};
}

test('release preparation rebuilds changed generated arena CSS while preserving Sudoku bytes',async t=>{
 const f=await fixture(t),before={};
 for(const name of ['public/sudoku.html','public/assets/css/app-sudoku.css','public/assets/css/sudoku.css'])before[name]=await readFile(join(f.root,name));
 const result=f.run('--pages=serpent.html');
 assert.equal(result.status,0,result.stderr);
 const css=await readFile(join(f.root,'public/assets/css/app-serpent.css'),'utf8');
 assert.match(css,/\.serpent\{color:green\}/);assert.match(css,/:root\{color-scheme:dark\}/);
 assert.doesNotMatch(css,/user compiled/);
 for(const [name,bytes]of Object.entries(before))assert.deepEqual(await readFile(join(f.root,name)),bytes,name);
});

test('invalid or duplicate page selection fails before writing an artifact',async t=>{
 const f=await fixture(t),before=await readFile(join(f.root,'public/assets/css/app-serpent.css'));
 for(const arg of ['--pages=serpent.html,missing.html','--pages=serpent.html,serpent.html','--pages=../sudoku.html','--pages=']){
  const result=f.run(arg);assert.notEqual(result.status,0);assert.match(result.stderr,/Invalid CSS page selection/);
  assert.deepEqual(await readFile(join(f.root,'public/assets/css/app-serpent.css')),before);
 }
});

test('selected CSS check detects stale output without rewriting it and rebuild is repeatable',async t=>{
 const f=await fixture(t),cssPath=join(f.root,'public/assets/css/app-serpent.css'),before=await readFile(cssPath);
 const check=f.run('--check','--pages=serpent.html');assert.notEqual(check.status,0);assert.deepEqual(await readFile(cssPath),before);
 assert.equal(f.run('--pages=serpent.html').status,0);
 const built=await readFile(cssPath),html=await readFile(join(f.root,'public/serpent.html'));
 assert.equal(f.run('--check','--pages=serpent.html').status,0);
 assert.equal(f.run('--pages=serpent.html').status,0);
 assert.deepEqual(await readFile(cssPath),built);assert.deepEqual(await readFile(join(f.root,'public/serpent.html')),html);
});

test('npm release verification rebuilds stale artifacts before the verifier reads them',async t=>{
 const f=await fixture(t),sourcePackage=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const manifest=JSON.parse(await readFile(join(f.root,'scripts/style-bundles.json'),'utf8'));
 for(const page of ['journey','paths-online']){
  manifest[page+'.html']=['assets/css/serpent.css'];
  await writeFile(join(f.root,'public',page+'.html'),`<html><head></head><body>${page}</body></html>`);
 }
 await writeFile(join(f.root,'scripts/style-bundles.json'),JSON.stringify(manifest));
 for(const name of ['build-offline.mjs','apply-premium.mjs','service-worker-runtime.txt','refresh-checksums.mjs'])await copyFile(fileURLToPath(new URL('../scripts/'+name,import.meta.url)),join(f.root,'scripts',name));
 await writeFile(join(f.root,'scripts/check-generated.mjs'),`import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';for(const p of ['serpent','journey','paths-online'])assert.match(await readFile('public/assets/css/app-'+p+'.css','utf8'),/color:green/);assert.match(await readFile('public/service-worker.js','utf8'),/busraj-games-v60-release-30-0-0/);`);
 await writeFile(join(f.root,'package.json'),JSON.stringify({name:'generated-release-fixture',version:'30.0.0',private:true,scripts:{'preverify:release':sourcePackage.scripts['preverify:release'],'verify:release':'node scripts/check-generated.mjs'}}));
 const sudoku=await readFile(join(f.root,'public/assets/css/app-sudoku.css'));
 const result=spawnSync('npm',['run','verify:release'],{cwd:f.root,encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(await readFile(join(f.root,'public/assets/css/app-sudoku.css'),'utf8'),/color:green/,'full release rebuilds every game bundle');
 assert.match(await readFile(join(f.root,'public/serpent.html'),'utf8'),/tahdia-premium-v25\.css\?v=30\.0\.0/,'premium CSS must be applied during release preparation');
 assert.match(await readFile(join(f.root,'public/serpent.html'),'utf8'),/tahdia-premium-v25\.js\?v=30\.0\.0/,'premium JS must be applied during release preparation');
 const first=await readFile(join(f.root,'public/service-worker.js'));
 const again=spawnSync('npm',['run','preverify:release'],{cwd:f.root,encoding:'utf8'});
 assert.equal(again.status,0,again.stdout+again.stderr);
 assert.deepEqual(await readFile(join(f.root,'public/service-worker.js')),first,'first build without a service worker must match subsequent builds');
});


test('v25 premium CSS survives route CSS regeneration and is accepted by full release CSS verification',async t=>{
 const f=await fixture(t),prem='tahdia-premium-v25.css?v=30.0.0';
 const manifest=JSON.parse(await readFile(join(f.root,'scripts/style-bundles.json'),'utf8'));
 manifest['memory.html']=['assets/css/memory.css'];
 await writeFile(join(f.root,'scripts/style-bundles.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(join(f.root,'public/memory.html'),'<html><head><link rel="stylesheet" href="assets/css/app-memory.css?v=23.0.1"></head><body>memory</body></html>');
 await writeFile(join(f.root,'public/assets/css/memory.css'),'.memory{color:royalblue}\n');
 await writeFile(join(f.root,'public/assets/css/app-memory.css'),'/* stale */\n');
 await copyFile(fileURLToPath(new URL('../scripts/apply-premium.mjs',import.meta.url)),join(f.root,'scripts/apply-premium.mjs'));
 assert.equal(f.run().status,0,'CSS builder should generate all route bundles');
 const premiumRun=spawnSync(process.execPath,['scripts/apply-premium.mjs'],{cwd:f.root,encoding:'utf8'});
 assert.equal(premiumRun.status,0,premiumRun.stderr);
 const after=await readFile(join(f.root,'public/memory.html'),'utf8');
 assert.match(after,/tahdia-premium-v25\.css\?v=30\.0\.0/);
 assert.equal(f.run('--check').status,0,'--check across all routes must accept generated CSS with external premium theme');
 assert.equal(f.run().status,0,'second build should be idempotent');
 assert.deepEqual(await readFile(join(f.root,'public/memory.html'),'utf8'),after,'rebuild must preserve theme and original ordering');
 assert.equal(f.run('--check').status,0);
 await writeFile(join(f.root,'public/assets/css/memory.css'),'.memory{color:red}\n');
 const stale=f.run('--check');
 assert.notEqual(stale.status,0,'stale CSS bundle should still be rejected');
 assert.match(stale.stderr,/Rebuild styles: memory\.html/);
 assert.equal(f.run().status,0,'rebuild after modifying source');
 assert.equal(f.run('--check').status,0);
 // Duplicate premium injections must be rejected rather than silently hidden.
 const h=await readFile(join(f.root,'public/memory.html'),'utf8');
 await writeFile(join(f.root,'public/memory.html'),h.replace('</head>',`<link rel="stylesheet" href="/assets/css/${prem}"></head>`));
 const doubled=f.run('--check');
 assert.notEqual(doubled.status,0);
 assert.match(doubled.stderr,/Duplicate premium stylesheet/);
});
