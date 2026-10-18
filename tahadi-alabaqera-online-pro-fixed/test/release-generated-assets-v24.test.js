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
 for(const name of ['build-offline.mjs','service-worker-runtime.txt'])await copyFile(fileURLToPath(new URL('../scripts/'+name,import.meta.url)),join(f.root,'scripts',name));
 await writeFile(join(f.root,'scripts/check-generated.mjs'),`import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';for(const p of ['serpent','journey','paths-online'])assert.match(await readFile('public/assets/css/app-'+p+'.css','utf8'),/color:green/);assert.match(await readFile('public/service-worker.js','utf8'),/busraj-games-v52-release-24-0-1/);`);
 await writeFile(join(f.root,'package.json'),JSON.stringify({name:'generated-release-fixture',private:true,scripts:{'preverify:release':sourcePackage.scripts['preverify:release'],'verify:release':'node scripts/check-generated.mjs'}}));
 const sudoku=await readFile(join(f.root,'public/assets/css/app-sudoku.css'));
 const result=spawnSync('npm',['run','verify:release'],{cwd:f.root,encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.deepEqual(await readFile(join(f.root,'public/assets/css/app-sudoku.css')),sudoku);
 const first=await readFile(join(f.root,'public/service-worker.js'));
 const again=spawnSync('npm',['run','preverify:release'],{cwd:f.root,encoding:'utf8'});
 assert.equal(again.status,0,again.stdout+again.stderr);
 assert.deepEqual(await readFile(join(f.root,'public/service-worker.js')),first,'first build without a service worker must match subsequent builds');
});
