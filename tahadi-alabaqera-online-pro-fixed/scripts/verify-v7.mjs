import assert from 'node:assert/strict';
import {readFile,readdir,access,stat} from 'node:fs/promises';
import {dirname,join,resolve,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),publicDir=join(root,'public');
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.git','.wrangler'].includes(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push(path)}return files}
const files=await walk(root);let js=0,inline=0,cssAssets=0;
for(const file of files){
 const ext=extname(file);
 if(['.js','.mjs'].includes(ext)){const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(check.status,0,relative(root,file)+'\n'+check.stderr);js++}
 if(ext==='.html'&&file.startsWith(publicDir)){
  const html=await readFile(file,'utf8');
  assert.doesNotMatch(html,/<script[^>]+src=["'][^"']*(?:firebase|commercial-upgrade-engine|snake-pro-career-engine|v5-ultimate-expansion|snake-pro-upgrade)/i,'obsolete active script: '+relative(root,file));
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(/\bsrc\s*=/.test(match[1])||!/\S/.test(match[2])||/type=["'](?:application\/ld\+json|application\/json)["']/.test(match[1]))continue;
   const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:match[2],encoding:'utf8'});assert.equal(check.status,0,relative(root,file)+' inline script\n'+check.stderr);inline++;
  }
 }
 if(ext==='.css'){
  const css=await readFile(file,'utf8');
  for(const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)){
   const raw=match[1].trim();if(/^(?:data:|https?:|\/\/|#)/i.test(raw))continue;
   const clean=decodeURIComponent(raw.split(/[?#]/)[0]),target=clean.startsWith('/')?resolve(publicDir,clean.slice(1)):resolve(dirname(file),clean);
   await access(target).catch(()=>{throw new Error(relative(root,file)+' missing CSS asset: '+raw)});cssAssets++;
  }
 }
}
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
assert.equal(pkg.version,'23.0.0');assert.equal(lock.version,'23.0.0');assert.equal(lock.packages[''].version,'23.0.0');
const config=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
assert.ok(config.durable_objects.bindings.some(b=>b.name==='QUICK_ARENA'&&b.class_name==='QuickArena'));
assert.equal(config.migrations.at(-1).tag,'v6-authoritative-quick-arena');
const sw=await readFile(join(publicDir,'service-worker.js'),'utf8'),shell=sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/)[1],paths=[...shell.matchAll(/['"]([^'"]+)['"]/g)].map(m=>m[1]);
assert.equal(paths.length,new Set(paths).size,'duplicate offline cache paths');assert.match(sw,/const CACHE_NAME = 'busraj-games-v50-release-23-0-0'/);
const demand=JSON.parse(sw.match(/const ON_DEMAND = (\[[\s\S]*?\]);/)[1]);
for(const asset of ['serpent-ui.js','serpent-renderer.js','engines/serpent-engine.js','cosmetic-art.js','profile-core.js','career-client.js','pro-dice.js','shop.js','arcade-games.js','pro-experience.js','engines/snakes-adventure.js','engines/bot-strategy.js'])assert.ok(demand.includes('/assets/js/'+asset),'on-demand dependency absent: '+asset);
for(const page of ['serpent','snakes','jackaroo','zahra','dice','shop','puzzle','memory','reaction','accuracy','logic','online','social','local','journey'])assert.ok(demand.includes('/'+page+'.html'),'on-demand page absent: '+page);
for(const core of ['journey-ui.js','journey-client.js','journey-renderer.js','engines/journey-engine.js','match3-renderer.js','engines/match3-engine.js'])assert.ok(paths.includes('/assets/js/'+core+'?v='+pkg.version),'offline journey dependency absent: '+core);
let coreBytes=0;for(const path of paths)coreBytes+=(await stat(join(publicDir,path==='/'?'index.html':path.slice(1).split('?')[0]))).size;assert.ok(coreBytes<1000000,'offline install exceeds 1 MB: '+coreBytes);
for(const script of ['build-styles.mjs','build-offline.mjs']){const check=spawnSync(process.execPath,[join(root,'scripts',script),'--check'],{encoding:'utf8'});assert.equal(check.status,0,check.stdout+check.stderr);}
assert.doesNotMatch(await readFile(join(publicDir,'snakes.html'),'utf8'),/snakes-reference-portrait|MutationObserver|assets\/js\/(?:adaptive-board-layout|fullscreen-game|luxury-game-ui)\.js/);
console.log(`V${pkg.version} release verification passed: ${js} JS modules, ${inline} inline scripts, ${cssAssets} CSS asset references, ${paths.length} offline core resources (${coreBytes} bytes).`);
