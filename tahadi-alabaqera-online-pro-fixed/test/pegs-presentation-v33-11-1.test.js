import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import * as three from '../public/assets/vendor/three-r187-pegs.js';
import * as engine from '../public/assets/js/engines/pegs-engine.js';
import * as presentation from '../public/assets/js/pegs/presentation.js';
import * as symbols from '../public/assets/js/pegs/symbols.js';
import * as targets from '../public/assets/js/pegs/targets.js';

// Real Three.js scene and camera; GPU rasterization is deliberately outside this test.
function canvas(){return {width:1,height:1,style:{},addEventListener(){},remove(){},getContext(){return new Proxy({},{get(o,k){return o[k]??(k.startsWith('create')?()=>({addColorStop(){}}):()=>{});},set(o,k,v){o[k]=v;return true;}});}};}
class Renderer{constructor(){this.domElement=canvas();this.shadowMap={};}setClearColor(){}setPixelRatio(){}setSize(){}dispose(){}render(s,c){s.updateMatrixWorld();c.updateMatrixWorld();}}
class PMREM{fromScene(){return {texture:new three.CanvasTexture(canvas())};}dispose(){}}
async function scene(large,width=390,height=500){
 const context=vm.createContext({console,Math,performance,document:{createElement:canvas},window:{devicePixelRatio:1},requestAnimationFrame:()=>1,cancelAnimationFrame(){},...engine,...presentation,...symbols,...targets,T:{...three,WebGLRenderer:Renderer,PMREMGenerator:PMREM}});
 const source=(await readFile(new URL('../public/assets/js/pegs/stage3d.js',import.meta.url),'utf8')).replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'').replace(/export \{drawSymbol\};/,'').replace(/\bexport /g,'');
 vm.runInContext(source+'\nglobalThis.factory=createPegsStage3D;',context);
 const stage=context.factory({large}),state=engine.createPegsGame(['A','B'],{large});stage.attach({prepend(){},getBoundingClientRect:()=>({width,height})});stage.draw({pegs:state.pegs,fx:state.pegs.map(()=>({})),time:1000});return {stage,state};
}
test('classic hole positions retain the original three rings, and both table sizes remain circular',()=>{
 const holes=engine.pegsHoles();let i=0;
 for(const [n,r,off] of [[12,.8,0],[8,.52,Math.PI/8],[4,.24,Math.PI/4]])for(let k=0;k<n;k++,i++){
  const a=off+k*Math.PI*2/n-Math.PI/2;assert.ok(Math.abs(holes[i].x-Math.cos(a)*r)<1e-12);assert.ok(Math.abs(holes[i].y-Math.sin(a)*r)<1e-12);
 }
 const large=engine.pegsHoles(true);assert.equal(large.length,48);assert.ok(large.every(p=>Math.hypot(p.x,p.y)<=.851));
 for(let a=0;a<large.length;a++)for(let b=0;b<a;b++)assert.ok(Math.hypot(large[a].x-large[b].x,large[a].y-large[b].y)>.16);
});
test('the actual scene uses the previous camera angles and a round table in both sizes',async()=>{
 for(const large of [false,true])for(const [w,h,expected] of [[390,570,55],[390,390,50],[600,330,42]]){
  const {stage,state}=await scene(large,w,h),{camera,world}=stage.parts;
  const angle=Math.atan2(camera.position.y-.05,Math.hypot(camera.position.x,camera.position.z))*180/Math.PI;assert.ok(Math.abs(angle-expected)<.001);
  let board;world.traverse(n=>{if(n.geometry?.type==='CylinderGeometry'&&n.geometry.parameters.radiusTop===1)board=n;});assert.equal(board.scale.z,1);
  assert.ok(state.pegs.every((_,i)=>{const p=stage.middle(i);return stage.hit(p.x,p.y,state.pegs)===i;}),'every projected crown selects its own piece');stage.dispose();
 }
});
test('a six-face beveled cube displays all eight authoritative colors and restores its normal palette',async()=>{
 const {stage}=await scene(true),die=stage.parts.die;assert.equal(die.geometry.groups.length,6);assert.equal(die.material.length,6);
 const normal=[...die.material];
 for(let color=0;color<8;color++){
  const palette=presentation.pegsDiePalette(color),face=presentation.pegsDieFace(color);assert.equal(palette[face],color);assert.equal(palette.length,6);
  stage.die.show(color);assert.equal(die.material.length,6);assert.ok(die.quaternion.toArray().every(Number.isFinite));
  if(color<6)assert.equal(die.material[face],normal[face]);else assert.notEqual(die.material[face],normal[face]);
 }
 stage.die.show(2);assert.deepEqual([...die.material],normal);stage.dispose();
});
test('resyncing or disposing a rolling die resolves the old animation without replaying stale faces',async()=>{
 const {stage}=await scene(true);let landed=0;stage.onLand=()=>landed++;
 const pending=stage.die.roll([6,7]);stage.die.show(1);const expected=stage.parts.die.quaternion.clone();await pending;
 assert.equal(landed,0);assert.ok(stage.parts.die.quaternion.equals(expected));
 const leaving=stage.die.roll([0,1]);stage.dispose();await leaving;assert.equal(landed,0);
});
