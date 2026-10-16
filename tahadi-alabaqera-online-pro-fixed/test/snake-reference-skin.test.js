import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('snake gameplay does not load the retired portrait skin or overlapping effect layers',async()=>{const html=await readFile(join(root,'public/snakes.html'),'utf8');assert.match(html,/app-(?:snakes|jackaroo)\.css/);assert.match(html,/pro-dice\.js/);assert.doesNotMatch(html,/snake-reference-skin\.png|snake-pro-upgrade\.js|v5-ultimate-expansion\.js/);assert.match(html,/await runSoloAi\(\)/)});

test('current arena images are valid lossless WebP with their original dimensions', async () => {
  for(const [name,width,height] of [['neon-cobra',1024,1536],['objects',2048,768],['arena-plate',853,1844],['jackaroo-table',1254,1254]]){
    const bytes=await readFile(join(root,'public/assets/arena',name+'.webp'));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    let dimensions;
    for(let offset=12;offset+8<bytes.length;){
      const kind=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),body=offset+8;
      if(kind==='VP8X')dimensions=[bytes.readUIntLE(body+4,3)+1,bytes.readUIntLE(body+7,3)+1];
      if(kind==='VP8L'){assert.equal(bytes[body],0x2f);const bits=bytes.readUInt32LE(body+1);dimensions=[(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];break}
      offset=body+size+(size%2);
    }
    assert.deepEqual(dimensions,[width,height],name);
  }
});

test('snake turn has a keyboard-safe action path and no stale overlay badge', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  assert.match(html, /function rollTurn\(\)/);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /classList\.add\('has-rolled'\)/);
  assert.match(html, /console\.error\('Snake turn failed'/);
});
