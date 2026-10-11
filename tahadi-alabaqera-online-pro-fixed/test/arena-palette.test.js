import test from 'node:test';
import assert from 'node:assert/strict';
let palette={};try{palette=await import('../public/assets/js/arena-palette.js')}catch{}
test('neon recoloring preserves the painted mouth, ivory teeth and transparency',()=>{
 assert.equal(typeof palette.recolorBluePixels,'function');
 const pixels=new Uint8ClampedArray([0,130,255,230,110,5,160,255,240,242,235,255,0,100,255,0]);
 const before=pixels.slice();palette.recolorBluePixels(pixels,155);
 assert.ok(pixels[1]>pixels[0]*2&&pixels[1]>pixels[2],'blue scales should take the selected emerald hue');
 assert.equal(pixels[3],230);
 assert.deepEqual(pixels.slice(4),before.slice(4),'mouth, teeth and fully transparent pixels retain their source values');
});
