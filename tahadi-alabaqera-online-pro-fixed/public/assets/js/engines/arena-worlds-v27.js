import {powerActive} from './arena-drops-v24.js';
// One deterministic simulation for the browser and the authoritative room server.
export const SERPENT_WORLDS=Object.freeze({
 classic:{id:'classic',name:'مدار الطاقة',width:1600,height:1600,foodCount:230,color:'#73e9c8',feature:'منارة الطاقة',description:'سيطر على المنارة لتحصل على طاقة إضافية كل ثانيتين.'},
 neon:{id:'neon',name:'سباق النيون',width:2000,height:1800,foodCount:260,color:'#65d8ff',feature:'مسارات الاندفاع',description:'المسارات الزرقاء تزيد سرعتك 30٪ دون استهلاك الطول.'},
 forest:{id:'forest',name:'حدائق النبض',width:2200,height:2200,foodCount:280,color:'#9fdb79',feature:'واحات النمو',description:'ثلاث واحات تنبض بالحياة وتنمّي جسمك كل ثانيتين.'},
 crystals:{id:'crystals',name:'وادي البلّور',width:2100,height:2100,foodCount:270,color:'#cba2ff',feature:'نوافير البلّور',description:'نوافير كنوز كل 18 ثانية؛ اجمع البلورات المتتابعة لمكافأة السلسلة.'},
 volcano:{id:'volcano',name:'جزر الحمم',width:2100,height:2000,foodCount:260,color:'#ff9871',feature:'فوهات متحركة',description:'تحذير قبل الثوران. الحمم تبطّئك وتستنزف الطول؛ الدرع والاختفاء يحميانك.'},
 ruins:{id:'ruins',name:'بوابات الأطلال',width:2300,height:1900,foodCount:270,color:'#efcd8d',feature:'بوابتان مترابطتان',description:'ادخل بوابة واخرج من المقابلة. تعود جاهزة لك بعد 6 ثوانٍ.'},
 storm:{id:'storm',name:'عين العاصفة',width:2000,height:2200,foodCount:260,color:'#8dbdff',feature:'عين آمنة متنقلة',description:'اتبع العين الهادئة؛ الرياح خارجها تبطّئ الحركة أثناء موجة العاصفة.'}
});
export const worldPreset=id=>SERPENT_WORLDS[id]||SERPENT_WORLDS.classic;
export const validWorld=id=>Object.hasOwn(SERPENT_WORLDS,id);
export const ownerAllowed=(access,catalog=[])=>access?.role==='owner'&&Array.isArray(catalog);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const inside=(s,z)=>Math.hypot(s.x-z.x,s.y-z.y)<z.radius;
const stats=s=>s.worldStats??={gathered:0,boostSeconds:0,powers:0,portals:0,zones:0,combo:0,bestCombo:0};
const point=(g,x,y,radius,kind)=>({x:Math.round(g.width*x),y:Math.round(g.height*y),radius,kind});
export function initializeArenaWorld(g,id,options={}){
 const p=worldPreset(id),zones=p.id==='neon'?[{...point(g,.28,.48,80,'rail'),width:110,height:650},{...point(g,.72,.52,80,'rail'),width:110,height:650}]
 :p.id==='forest'?[point(g,.28,.32,105,'bloom'),point(g,.74,.43,105,'bloom'),point(g,.44,.77,105,'bloom')]
 :p.id==='crystals'?[point(g,.3,.3,65,'crystal'),point(g,.73,.5,65,'crystal'),point(g,.38,.75,65,'crystal')]
 :p.id==='volcano'?[point(g,.3,.3,120,'lava'),point(g,.72,.48,120,'lava'),point(g,.42,.75,120,'lava')]
 :p.id==='ruins'?[point(g,.23,.34,46,'portal'),point(g,.77,.66,46,'portal')]:[point(g,.5,.5,110,'beacon')];
 g.world={version:27,id:p.id,name:p.name,zones,phase:'calm',cycle:-1,frenzy:false,nextFountainAt:7,lastEvent:'',lastEventAt:-100,difficulty:options.difficulty||g.difficulty,training:options.training||'free'};
 for(const s of g.snakes){s.worldSpeed=1;stats(s);}return g.world;
}
function event(g,type,s,text,x=s?.x,y=s?.y){g.events.push({type,id:s?.id||null,text,x,y});if(!s||!s.bot){g.world.lastEvent=text;g.world.lastEventAt=g.elapsed;}}
function fountain(g,z){for(let i=0;i<12;i++){const a=i*Math.PI/6,r=45+i%2*23;g.food.push({id:'f'+g.nextFood++,x:clamp(z.x+Math.cos(a)*r,24,g.width-24),y:clamp(z.y+Math.sin(a)*r,24,g.height-24),value:i%3?3:5,kind:i%3?'star':'gem',radius:8,hue:3});}event(g,'fountain',null,'انفتحت نافورة البلّور',z.x,z.y);}
function teleport(g,s,entry,target){
 const x=clamp(target.x+Math.cos(s.angle)*81,40,g.width-40),y=clamp(target.y+Math.sin(s.angle)*81,40,g.height-40);
 if(g.snakes.some(o=>o.alive&&o.id!==s.id&&(Math.hypot(o.x-x,o.y-y)<75||o.segments.slice(-4).some(p=>Math.hypot(p.x-x,p.y-y)<55))))return;
 const dx=x-s.x,dy=y-s.y;s.x=x;s.y=y;s.segments=s.segments.map(p=>({x:clamp(p.x+dx,20,g.width-20),y:clamp(p.y+dy,20,g.height-20)}));s.portalReadyAt=g.elapsed+6;stats(s).portals++;event(g,'portal',s,'عبور البوابة',entry.x,entry.y);
}
export function stepArenaWorld(g,dt){
 const w=g.world;if(!w||w.version!==27||g.status!=='playing')return;const t=g.elapsed,id=w.id,period=id==='volcano'?16:id==='storm'?24:18,within=t%period,cycle=Math.floor(t/period);
 w.phase=id==='volcano'?(within<5?'calm':within<8?'warning':within<13?'active':'calm'):id==='storm'?(within<10?'calm':within<13?'warning':within<20?'active':'calm'):'calm';w.cycle=cycle;w.frenzy=id==='crystals'&&within>=7&&within<13;
 if(w.phase!==w.previousPhase){if(w.phase==='warning')event(g,'world-warning',null,id==='volcano'?'الفوهة ستثور بعد 3 ثوانٍ':'العاصفة تقترب — اتجه للعين');if(w.phase==='active')event(g,'world-active',null,id==='volcano'?'اندلاع الحمم':'العاصفة نشطة');w.previousPhase=w.phase;}
 if(id==='storm'){const z=w.zones[0];z.x=g.width*(.5+Math.sin(t/14)*.17);z.y=g.height*(.5+Math.cos(t/19)*.17);z.radius=240;}
 if(id==='crystals'&&t>=w.nextFountainAt){w.nextFountainAt=t+18;fountain(g,w.zones[cycle%3]);}
 for(const e of g.events.slice()){const s=g.snakes.find(s=>s.id===e.id);if(!s)continue;const st=stats(s);if(e.type==='eat'){st.gathered+=e.value||0;const previous=st.combo;st.combo=t-(s.lastGatherAt??-100)<2.5?Math.min(10,st.combo+1):1;s.lastGatherAt=t;st.bestCombo=Math.max(st.bestCombo,st.combo);if(st.combo===5||st.combo===10&&previous<10){const bonus=st.combo===10?5:3;s.mass=Math.min(720,s.mass+bonus);s.score+=bonus;event(g,'combo',s,'سلسلة ×'+st.combo+' · +'+bonus);}}if(e.type==='power')st.powers++;}
 for(const s of g.snakes){s.worldSpeed=1;if(!s.alive)continue;const st=stats(s);if(s.boost)st.boostSeconds+=dt;if(t-(s.lastGatherAt??-100)>2.5)st.combo=0;
  const atFeature=w.zones.some(z=>z.kind==='rail'?Math.abs(s.x-z.x)<z.width/2&&Math.abs(s.y-z.y)<z.height/2:inside(s,z));if(atFeature&&!s.worldZoneInside)st.zones++;s.worldZoneInside=atFeature;
  const protectedSnake=powerActive(s,'shield',t)||powerActive(s,'ghost',t);
  if(id==='neon'){const rail=w.zones.some(z=>Math.abs(s.x-z.x)<z.width/2&&Math.abs(s.y-z.y)<z.height/2);if(rail){s.worldSpeed=1.3;if(!s.inRail)event(g,'rail',s,'اندفاع النيون +30٪');}s.inRail=rail;}
  else if(id==='forest'||id==='classic'){if(atFeature&&t>=(s.nextBloomAt||0)){s.nextBloomAt=t+2;const value=id==='forest'?2:3;s.mass=Math.min(720,s.mass+value);s.score+=value;event(g,'zone',s,id==='forest'?'نبضة نمو +2':'منارة الطاقة +3');}}
  else if(id==='volcano'){if(w.phase==='active'&&inside(s,w.zones[cycle%3])&&!protectedSnake){s.worldSpeed=.82;if(t>=(s.nextLavaAt||0)){s.nextLavaAt=t+1;s.mass=Math.max(24,s.mass-2);event(g,'lava',s,'حرارة الحمم −2');}}}
  else if(id==='ruins'){const index=w.zones.findIndex(z=>inside(s,z));if(index>=0&&t>=(s.portalReadyAt||0))teleport(g,s,w.zones[index],w.zones[1-index]);}
  else if(id==='storm'&&w.phase==='active'&&!atFeature&&!protectedSnake)s.worldSpeed=.78;
 }
}
export function arenaWorldSnapshot(w){if(!w||w.version!==27)return undefined;return {version:27,id:w.id,name:w.name,zones:w.zones.map(z=>({...z})),phase:w.phase,cycle:w.cycle,frenzy:w.frenzy,lastEvent:w.lastEvent,lastEventAt:w.lastEventAt,nextFountainAt:w.nextFountainAt,training:w.training};}
export function trainingProgress(game,id,course='control'){
 const s=game.snakes.find(s=>s.id===id),st=s?.worldStats||{};
 const tasks=course==='combat'?[{name:'اجمع 40 طاقة',value:st.gathered||0,target:40},{name:'استبعد خصمًا',value:s?.kills||0,target:1},{name:'اصمد 45 ثانية',value:game.elapsed,target:45}]
 :course==='powers'?[{name:'اجمع قدرة مؤقتة',value:st.powers||0,target:1},{name:'اكتشف ميزة الخريطة',value:(st.zones||0)+(st.portals||0),target:1},{name:'سلسلة جمع من 5',value:st.bestCombo||0,target:5}]
 :[{name:'اجمع 20 طاقة',value:st.gathered||0,target:20},{name:'جرّب التسريع 3 ثوانٍ',value:st.boostSeconds||0,target:3},{name:'اصمد 30 ثانية',value:game.elapsed,target:30}];
 return tasks.map(t=>({...t,value:Math.min(t.target,Math.floor(t.value)),done:t.value>=t.target}));
}
