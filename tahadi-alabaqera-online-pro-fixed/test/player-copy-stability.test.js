import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';

async function files(dir){
  const found=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
    if(entry.isDirectory())found.push(...await files(path));
    else if(/\.(html|js)$/.test(entry.name))found.push(path);
  }
  return found;
}
test('playable pages and shared UI contain no automated-player label, while Baloot kaboot stays intact',async()=>{
  const unwanted=/(?<![ء-ي])(?:و?ال|و?ب|ل?ل)?بوت(?:ات|ان|ين|ك)?(?![ء-ي])/u;
  const failures=[];
  for(const path of await files(new URL('../public/',import.meta.url))){
    const source=await readFile(path,'utf8');
    if(unwanted.test(source))failures.push(path.pathname.split('/public/')[1]);
  }
  assert.deepEqual(failures,[]);
  assert.match(await readFile(new URL('../public/assets/js/engines/baloot-talk.js',import.meta.url),'utf8'),/كبوت/);
});
test('player chips use the same names without an automated-player badge',async()=>{
  const h=await createDOM('snakes.html');
  for(const player of [{bot:true,level:'hard'},{bot:false},null])assert.equal(h.context.botTag(player),null);
});
