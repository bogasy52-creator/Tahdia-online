/* Native Canvas QA from production exports, not browser screenshots.
   @napi-rs/canvas is supplied by the Codex primary runtime via NODE_PATH;
   install this optional QA dependency separately on other workstations. */
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {drawStudioBoard,drawStudioHero,drawStudioGem,createJewelsRenderer} from '../public/assets/js/jewels/studio-renderer.js';
import {createJewelsRace,chooseJewelsRaceMove,playJewelsRaceSwap,playJewelsRaceBooster} from '../public/assets/js/engines/jewels-race-engine.js';
const require=createRequire(import.meta.url),{createCanvas}=require('@napi-rs/canvas');
const directory=path.resolve(process.argv[2]||fileURLToPath(new URL('../docs/verification/jewels-studio-v33-10/',import.meta.url)));
await mkdir(directory,{recursive:true});
const board=createCanvas(840,840),hero=createCanvas(840,570),gems=createCanvas(1000,500);
let state=createJewelsRace(['أنت','المنافس'],{seed:91287,durationMs:0});
drawStudioBoard(board.getContext('2d'),state.players[0].board,840);await writeFile(path.join(directory,'opening-board.png'),board.toBuffer('image/png'));
drawStudioHero(hero.getContext('2d'),840,570,0);await writeFile(path.join(directory,'original-crystal-art.png'),hero.toBuffer('image/png'));
const ctx=gems.getContext('2d'),bg=ctx.createLinearGradient(0,0,1000,500);bg.addColorStop(0,'#6b3ba6');bg.addColorStop(1,'#28194c');ctx.fillStyle=bg;ctx.fillRect(0,0,1000,500);
for(let c=0;c<6;c++)drawStudioGem(ctx,110+c*156,112,143,c);
for(let c=0;c<6;c++)drawStudioGem(ctx,110+c*156,282,138,c,['rh','rv','bomb','ball','bomb','rh'][c]);
ctx.font='600 19px sans-serif';ctx.fillStyle='#d6b8ed';ctx.textAlign='center';ctx.fillText('ORIGINAL CUT-CRYSTAL CANVAS ART  ·  JEWELS STUDIO',500,438);await writeFile(path.join(directory,'gem-materials.png'),gems.toBuffer('image/png'));
let replay=null;
for(let i=0;i<18;i++){const m=chooseJewelsRaceMove(state,0,'hard',()=>.45);if(!m)break;state=m.type==='booster'?playJewelsRaceBooster(state,0,m.id,m.cell):playJewelsRaceSwap(state,0,m.a,m.b);if(state.players[0].last.phases.some(p=>p.fx?.length)){replay=state.players[0].last;break;}}
if(replay){const canvas=createCanvas(840,840);canvas.style={};let clock=0,frameId=0,done=false,captured=false;const frames=new Map(),renderer=createJewelsRenderer({canvas,reduceMotion:()=>false,raf:fn=>{frames.set(++frameId,fn);return frameId;},caf:id=>frames.delete(id),now:()=>clock});renderer.resize(840,1);const task=renderer.animate(replay).then(()=>done=true);
for(let tick=0;tick<700&&!done;tick++){clock+=16;const jobs=[...frames.values()];frames.clear();for(const fn of jobs)fn(clock);await Promise.resolve();await Promise.resolve();if(!captured&&tick>11){renderer.render(clock);await writeFile(path.join(directory,'live-cascade-frame.png'),canvas.toBuffer('image/png'));captured=true;}}
await task;renderer.setBoard(state.players[0].board);renderer.render(clock+1000);await writeFile(path.join(directory,'after-special-board.png'),canvas.toBuffer('image/png'));}
console.log(JSON.stringify({directory,seed:91287,used:state.players[0].used,score:state.players[0].score,specials:state.players[0].specials,replayed:Boolean(replay)},null,2));
