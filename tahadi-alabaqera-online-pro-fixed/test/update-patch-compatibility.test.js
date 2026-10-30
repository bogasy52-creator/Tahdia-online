import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, copyFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {removeIncompleteCharacterUpdate} from '../scripts/remove-incomplete-character-update.mjs';

test('completed character updates keep their tests even when an old cleanup command is invoked', async t => {
  const root=await mkdtemp(join(tmpdir(),'character-update-'));
  t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'test'));
  const names=['character-animation-v33.test.js','character-presentation-repair.test.js'];
  for(const name of names)await copyFile(new URL('./'+name,import.meta.url),join(root,'test',name));
  assert.deepEqual(removeIncompleteCharacterUpdate(root),[]);
  for(const name of names)assert.deepEqual(await readFile(join(root,'test',name)),await readFile(new URL('./'+name,import.meta.url)));
});

test('later character tests are never deleted or rejected by retired cleanup code', async t => {
  const root=await mkdtemp(join(tmpdir(),'future-character-update-'));
  t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'test'));
  const file=join(root,'test/character-animation-v33.test.js');await writeFile(file,'future complete implementation tests');
  assert.deepEqual(removeIncompleteCharacterUpdate(root),[]);
  assert.equal(await readFile(file,'utf8'),'future complete implementation tests');
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
  for(const name of ['preverify:release','prepare:release'])assert.doesNotMatch(pkg.scripts[name],/remove-incomplete-character-update/);
});

const builder=fileURLToPath(new URL('../scripts/create-update-patch.py',import.meta.url));
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'update-patch-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const base=join(root,'base'),project=join(root,'project'),output=join(root,'update.zip');
  for(const dir of [base,project]){
    await mkdir(join(dir,'public'),{recursive:true});
    await writeFile(join(dir,'package.json'),JSON.stringify({name:'busraj-games',version:'33.0.0'}));
    await writeFile(join(dir,'wrangler.jsonc'),'deployed settings');
    await writeFile(join(dir,'public/app.js'),'existing game');
    await writeFile(join(dir,'public/service-worker.js'),'generated old');
    await writeFile(join(dir,'SHA256SUMS.txt'),'generated checksums');
  }
  const run=(...extra)=>spawnSync('python3',[builder,'--base',base,'--project',project,'--output',output,...extra],{encoding:'utf8'});
  return{root,base,project,output,run};
}
function inspectZip(path){
  const r=spawnSync('python3',['-c',"import sys,zipfile,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({'names':z.namelist(),'manifest':json.loads(z.read('patch-manifest.json'))}))",path],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}

test('patch builder pins the actual installed base and omits regenerated cache and checksum files',async t=>{
  const f=await fixture(t);await writeFile(join(f.project,'public/app.js'),'updated game');
  await writeFile(join(f.project,'public/new.webp'),Buffer.from([1,2,3]));
  await writeFile(join(f.project,'public/service-worker.js'),'regenerated later');
  await writeFile(join(f.project,'SHA256SUMS.txt'),'different generated checksum');
  const r=f.run();assert.equal(r.status,0,r.stdout+r.stderr);const {names,manifest}=inspectZip(f.output);
  assert.equal(manifest.format,'busraj-sparse-patch-v1');assert.equal(manifest.version,'33.0.0');assert.deepEqual(manifest.supported_versions,['33.0.0']);
  assert.deepEqual(manifest.files.map(x=>x.path).sort(),['package.json','public/app.js','public/new.webp']);
  assert.deepEqual(manifest.files.find(x=>x.path==='public/new.webp').previous_sha256,[null]);
  assert.match(manifest.files.find(x=>x.path==='public/app.js').previous_sha256[0],/^[a-f0-9]{64}$/);
  assert.equal(names.length,5);assert.ok(names.includes('PATCH_INSTRUCTIONS_AR.md'));
  assert.equal(await readFile(join(f.base,'public/app.js'),'utf8'),'existing game');
});

test('patch builder refuses unsupported deletion without producing an incomplete update',async t=>{
  const f=await fixture(t);await rm(join(f.project,'public/app.js'));const r=f.run();
  assert.notEqual(r.status,0);assert.match(r.stderr,/delet|remov/i);
  await assert.rejects(readFile(f.output),{code:'ENOENT'});
});

test('patch builder preserves deployed Worker settings and refuses linked source files',async t=>{
  const f=await fixture(t);await writeFile(join(f.project,'wrangler.jsonc'),'changed worker');
  let r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Worker|wrangler/i);
  await writeFile(join(f.project,'wrangler.jsonc'),'deployed settings');
  await symlink(join(f.base,'public/app.js'),join(f.project,'public/linked.js'));
  r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/link/i);
  await rm(join(f.project,'public/linked.js'));
  await writeFile(join(f.project,'public/invalid:name.js'),'invalid path');
  r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/Unsafe.*path/i);
  await assert.rejects(readFile(f.output),{code:'ENOENT'});
});

test('future release numbers are derived from both packages instead of a permanent version lock',async t=>{
  const f=await fixture(t);await writeFile(join(f.project,'package.json'),JSON.stringify({name:'busraj-games',version:'33.1.0'}));
  const r=f.run();assert.equal(r.status,0,r.stdout+r.stderr);const {manifest}=inspectZip(f.output);
  assert.equal(manifest.version,'33.1.0');assert.deepEqual(manifest.supported_versions,['33.0.0']);
});
