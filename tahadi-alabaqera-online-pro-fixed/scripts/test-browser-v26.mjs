import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRuntime} from './local-runtime-v26.mjs';

const runtime=await createRuntime(),output=process.env.QA_OUTPUT_DIR||await mkdtemp(join(tmpdir(),'tahdia-browser-v26-'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.BROWSER_BINARY||chromium.executablePath()});
const checks=[],errors=[];
const base=runtime.url.replace(/\/$/,'');
const contextOptions={viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'};
const routeUrl=route=>base+'/'+route;
function observe(page,label){page.on('pageerror',error=>errors.push({label,error:error.message}));}
async function visible(page,selector){await page.locator(selector).waitFor({state:'visible',timeout:10000});}
async function open(page,route){await page.goto(routeUrl(route));await page.waitForTimeout(260);}
async function noOverflow(page,label){const geometry=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(geometry.document<=geometry.viewport+2,label+': horizontal overflow '+JSON.stringify(geometry));}
async function capture(page,name){await page.screenshot({path:join(output,name+'.png'),fullPage:false});}

try{
 const context=await browser.newContext(contextOptions);
 // All launchers must remain usable at desktop and a real phone-sized viewport.
 const routes=['','shop','social','quiz','snakes','jackaroo','zahra','dice','memory','reaction','logic','puzzle','sudoku','serpent','picture','journey?game=jewels','journey?game=paths','paths-online','online','local'];
 for(const width of [1440,390]){
  const c=await browser.newContext({...contextOptions,viewport:{width,height:width===1440?1000:844}});
  for(const route of routes){
   const page=await c.newPage();observe(page,route+'@'+width);await open(page,route);
   assert.ok((await page.title()).length>3);assert.ok((await page.locator('body').innerText()).trim().length>70);
   await noOverflow(page,route+'@'+width);
   if(width===390){for(const button of await page.locator('.v26-command-utilities [data-audio-toggle],.v26-command-utilities [data-settings-open],#sudokuHelp').all())assert.equal(await button.isVisible(),true,'mobile utility remains available');}
   if(['','shop','dice','serpent','memory','sudoku'].includes(route))await capture(page,(route||'home')+'-'+width);
   await page.close();
  }
  await c.close();checks.push('20 launchers render without overflow or script errors at '+width+'px');
 }
 const home=await context.newPage();observe(home,'library');await open(home,'');
 assert.equal(await home.locator('.home-game').count(),15);assert.equal(await home.locator('a[href="/accuracy"]').count(),0);
 await home.locator('#gameSearch').fill('الذَاكـرة');await visible(home,'.home-game:visible');assert.equal(await home.locator('.home-game:visible').count(),1);
 await home.locator('#gameSearch').fill('');await home.locator('[data-category="friends"]').click();assert.ok(await home.locator('.home-game:visible').count()>4);
 await home.goto(routeUrl('accuracy'));assert.ok(home.url().endsWith('/#games'));checks.push('Arabic search, categories and the removed shooter route work');

 const dice=await context.newPage();observe(dice,'dice');await open(dice,'dice');await dice.locator('#playerCount').selectOption('2');await dice.locator('#startBtn').click();await visible(dice,'#game');
 assert.equal(await dice.locator('#die .pro-face').count(),6);assert.equal(await dice.locator('#die .pro-pip').count(),21);
 await dice.locator('#roll').click();await dice.waitForFunction(()=>Number(document.getElementById('die').dataset.value)>=1&&Number(document.getElementById('die').dataset.value)<=6&&!document.getElementById('roll').disabled);
 await dice.evaluate(async()=>{const core=BS_CAREER_CORE,p=core.normalize({owned:['dice-crystal'],equipped:{dice:'dice-crystal'}});localStorage.setItem('busraj-career-v6',JSON.stringify(p));await BS_CAREER.refresh();});
 assert.equal(await dice.locator('html').getAttribute('data-dice'),'dice-crystal');const crystal=await dice.locator('#die .pro-pip').first().evaluate(e=>({radius:getComputedStyle(e).borderRadius,rotate:getComputedStyle(e).rotate}));assert.equal(crystal.rotate,'45deg');
 await capture(dice,'dice-crystal-play');checks.push('Dice roll resolves to one real face and the crystal material changes live pip geometry');

 for(const route of ['memory','reaction','logic','puzzle']){
  const page=await context.newPage();observe(page,route+'-play');await open(page,route);await page.locator('#start').click();
  if(route==='memory'){assert.equal(await page.locator('.memory-tile').count(),16);await page.locator('.memory-tile').first().click();assert.equal(await page.locator('.memory-tile.open').count(),1);}
  if(route==='reaction'){await page.locator('#reactionPad').click();assert.match(await page.locator('#status').innerText(),/مبكر/);}
  if(route==='logic'){await page.locator('.logic-options button').first().click();assert.ok(await page.locator('.logic-options button:disabled').count()>1);}
  if(route==='puzzle')assert.equal(await page.locator('#arena button').count(),9);
  await noOverflow(page,route+' playing');await page.close();
 }
 checks.push('Memory, reaction, logic and number puzzle start and respond to actual input');
 for(const route of ['snakes','jackaroo','zahra']){
  const page=await context.newPage();observe(page,route+'-play');await open(page,route);await page.locator('#startBtn').click();await visible(page,'#game');
  if(route==='snakes')assert.equal(await page.locator('.snake-cell').count(),100);
  if(route==='jackaroo')assert.equal(await page.locator('.track-hole').count(),52);
  await noOverflow(page,route+' playing');await capture(page,route+'-play');await page.close();
 }
 checks.push('All three board games start with their real boards and pieces');
 for(const game of ['jewels','paths']){const page=await context.newPage();observe(page,'journey-'+game);await open(page,'journey?game='+game);await page.locator('#journeyContinue').click();await visible(page,'#journeyPlay');assert.ok(await page.locator('#stageCanvas').evaluate(e=>e.width>0&&e.height>0));await page.close();}
 const sudoku=await context.newPage();observe(sudoku,'sudoku-play');await open(sudoku,'sudoku');await sudoku.locator('#sudokuContinue').click();await visible(sudoku,'#sudokuPlay');assert.equal(await sudoku.locator('#sudokuBoard button').count(),81);await sudoku.close();
 const picture=await context.newPage();observe(picture,'picture-play');await open(picture,'picture');await picture.locator('#practice').click();await visible(picture,'#match');assert.ok(await picture.locator('#board').evaluate(e=>e.children.length>0));await picture.close();
 checks.push('Jewels, paths stages, Sudoku and picture puzzle start real playable rounds');

 const phone=await browser.newContext({...contextOptions,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 for(const route of ['snakes','jackaroo','zahra','dice','memory','reaction','logic','puzzle']){
  const page=await phone.newPage();observe(page,route+'-phone-play');await open(page,route);await page.locator(['snakes','jackaroo','zahra','dice'].includes(route)?'#startBtn':'#start').click();await noOverflow(page,route+' phone gameplay');
  const action=page.locator(['snakes','zahra','dice'].includes(route)?'#roll':route==='memory'?'.memory-tile':route==='reaction'?'#reactionPad':route==='logic'?'.logic-options button':route==='puzzle'?'#arena button':'#board').first();await action.waitFor({state:'visible'});
  if(['snakes','jackaroo','dice'].includes(route))await capture(page,route+'-phone-play');await page.close();
 }
 const phoneSudoku=await phone.newPage();observe(phoneSudoku,'sudoku-phone-play');await open(phoneSudoku,'sudoku');await phoneSudoku.locator('#sudokuContinue').click();await visible(phoneSudoku,'#sudokuPlay');await noOverflow(phoneSudoku,'Sudoku phone gameplay');await capture(phoneSudoku,'sudoku-phone-play');await phoneSudoku.close();
 const phoneSerpent=await phone.newPage();observe(phoneSerpent,'serpent-phone-play');await open(phoneSerpent,'serpent');await phoneSerpent.locator('[data-mode="solo"]').click();await phoneSerpent.locator('#arenaStart').click();await visible(phoneSerpent,'#arenaPlay');await noOverflow(phoneSerpent,'Serpent phone gameplay');assert.equal(await phoneSerpent.locator('#bsGameCommand').isVisible(),false);await visible(phoneSerpent,'#arenaExit');await phoneSerpent.waitForTimeout(150);
 const hudBoxes=await phoneSerpent.locator('.arena-energy,.arena-coach-task-v15,.arena-live-hint,#boost1').evaluateAll(elements=>elements.filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 for(let a=0;a<hudBoxes.length;a++)for(let b=a+1;b<hudBoxes.length;b++){const x=hudBoxes[a],y=hudBoxes[b];assert.ok(x.right<=y.x||y.right<=x.x||x.bottom<=y.y||y.bottom<=x.y,'phone HUD overlap: '+JSON.stringify([x,y]));}
 await capture(phoneSerpent,'serpent-phone-play');await phone.close();
 checks.push('Ten game rounds start at a touch phone viewport; boards, actions and immersive HUD stay accessible');

 const manager=await context.newPage();observe(manager,'manager');await open(manager,'serpent');
 await manager.evaluate(async()=>{await BS_SOCIAL.signup({username:'bosrag',displayName:'المدير',password:'Browser-test-only-2026'});await BS_CAREER.refresh();});
 assert.equal(await manager.evaluate(()=>BS_CAREER.access().role),'owner');assert.equal(await manager.evaluate(()=>BS_CAREER.get().equipped.snake),'snake-sovereign');
 await manager.locator('#arenaName').fill('المدير');await manager.locator('[data-mode="solo"]').click();await manager.locator('#arenaStart').click();await visible(manager,'#arenaPlay');
 await manager.waitForFunction(()=>document.getElementById('arenaWorldStatus').textContent.includes('المدير'));assert.equal(await manager.locator('#bsGameCommand').isVisible(),false,'arena HUD owns immersive controls');
 await capture(manager,'manager-serpent-play');checks.push('Authenticated manager enters the arena with the exclusive serpent and visible identity');

 const aliceContext=await browser.newContext(contextOptions),bobContext=await browser.newContext(contextOptions);
 const alice=await aliceContext.newPage(),bob=await bobContext.newPage();observe(alice,'alice');observe(bob,'bob');await open(alice,'snakes');await open(bob,'memory');
 await alice.evaluate(async()=>{await BS_SOCIAL.signup({username:'alice26',displayName:'أليس',password:'Browser-test-only-2026'});await BS_CAREER.refresh();});
 await bob.evaluate(async()=>{await BS_SOCIAL.signup({username:'bob26',displayName:'بوب',password:'Browser-test-only-2026'});await BS_CAREER.refresh();});
 await alice.evaluate(()=>BS_SOCIAL.requestFriend('bob26'));await bob.evaluate(()=>BS_SOCIAL.respondFriend('alice26',true));
 await alice.locator('#modeOnline').click();await alice.locator('#onlineName').fill('أليس');await alice.locator('#onlineCount').selectOption('2');await alice.locator('#createRoom').click();await visible(alice,'#readyBtn');
 const code=(await alice.locator('#copyCode').innerText()).trim();assert.match(code,/^\d{6}$/);
 await alice.evaluate(code=>BS_SOCIAL.invite('bob26','snakes',code),code);await visible(bob,'#bsSocialInvite');assert.equal(await bob.locator('#bsSocialInvite a').getAttribute('href'),'/snakes?room='+code);
 await bob.route('**/api/board/rooms/*/status',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.continue();});
 await bob.locator('#bsSocialInvite a').click();await visible(bob,'#joinRoom');await bob.waitForFunction(()=>document.getElementById('joinRoom').disabled);await bob.evaluate(()=>document.getElementById('joinRoom').onclick());await visible(bob,'#readyBtn');assert.equal(await bob.locator('#roomPlayers .room-player').count(),2);
 await alice.locator('#readyBtn').click();await bob.locator('#readyBtn').click();await alice.waitForFunction(()=>!document.getElementById('hostStart').disabled);await alice.locator('#hostStart').click();await visible(alice,'#game');await visible(bob,'#game');
 await bobContext.setOffline(true);await bob.waitForTimeout(450);await bobContext.setOffline(false);await bob.waitForFunction(()=>document.getElementById('liveNet').classList.contains('online'),null,{timeout:15000});await visible(bob,'#game');assert.equal(await bob.locator('#gameRoomCode').innerText(),code);
 await capture(bob,'two-player-reconnected');checks.push('Two browser accounts receive an in-game invite, join, ready, start and return from a network interruption');

 assert.deepEqual(errors,[],'Browser script exceptions: '+JSON.stringify(errors));
 const report={browser:'Chromium via Playwright (Browser plugin unavailable)',production:false,viewports:[1440,390],checks,scriptErrors:errors,screenshots:output};
 await writeFile(join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await runtime.dispose();}
