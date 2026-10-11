import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

test('new foley files are stereo PCM with headroom for simultaneous game sounds',async()=>{
 const dir=new URL('../public/assets/sounds/arena-v9/',import.meta.url),files=await readdir(dir);
 assert.equal(files.length,20);
 for(const name of files){
  const bytes=await readFile(new URL(name,dir));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),2);assert.equal(bytes.readUInt32LE(24),44100);assert.equal(bytes.readUInt16LE(34),16);
  let peak=0,power=0;const samples=(bytes.length-44)/2;
  for(let i=44;i<bytes.length;i+=2){const value=bytes.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(value));power+=value*value;}
  assert.ok(peak<.5&&peak>.2,name+' must have unclipped audible peaks');assert.ok(Math.sqrt(power/samples)>.009,name+' must not be silent');
 }
});
