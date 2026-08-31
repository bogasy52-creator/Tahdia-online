import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function loadLayoutEngine(){
  const source=await readFile(new URL('../public/assets/js/adaptive-board-layout.js',import.meta.url),'utf8');
  const window={};
  vm.runInNewContext(source,{window,Math,Number,Object},{filename:'adaptive-board-layout.js'});
  return window.BS_ADAPTIVE_BOARD_LAYOUT.computeAdaptiveBoardLayout;
}

async function runFullscreenController({width,height,mainWidth,mainHeight}){
  const [layoutSource,controllerSource]=await Promise.all([
    readFile(new URL('../public/assets/js/adaptive-board-layout.js',import.meta.url),'utf8'),
    readFile(new URL('../public/assets/js/fullscreen-game.js',import.meta.url),'utf8'),
  ]);
  const properties=new Map();
  const style={setProperty:(name,value)=>properties.set(name,value)};
  const classNames=new Set(['game-running','game-snakes']);
  const body={style,dataset:{},classList:{contains:(name)=>classNames.has(name)}};
  const root={style:{setProperty(){}},clientWidth:width,requestFullscreen(){}};
  const main={getBoundingClientRect:()=>({width:mainWidth,height:mainHeight})};
  const board={};
  const document={
    body,
    documentElement:root,
    fullscreenElement:null,
    querySelectorAll:()=>[],
    querySelector:(selector)=>selector.includes('game-main')?main:selector.includes('snake-board-wrap')?board:null,
    addEventListener(){},
  };
  let layoutEvent=null;
  const ResizeObserver=class{observe(){}};
  const window={
    innerWidth:width,
    innerHeight:height,
    visualViewport:{width,height,addEventListener(){}},
    ResizeObserver,
    addEventListener(){},
    dispatchEvent:(event)=>{layoutEvent=event;},
  };
  const context={
    window,
    document,
    MutationObserver:class{observe(){}},
    ResizeObserver,
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
    requestAnimationFrame:(callback)=>{callback();return 1;},
    cancelAnimationFrame(){},
    setTimeout,
    Math,
    Number,
    Object,
  };
  vm.runInNewContext(layoutSource,context,{filename:'adaptive-board-layout.js'});
  vm.runInNewContext(controllerSource,context,{filename:'fullscreen-game.js'});
  return {body,properties,layoutEvent};
}

test('portrait phones use the full screen width for the board',async()=>{
  const compute=await loadLayoutEngine();
  const layout=compute({width:390,height:844});

  assert.equal(layout.mode,'portrait');
  assert.equal(layout.boardSize,390);
  assert.equal(layout.topStrip,36);
  assert.equal(layout.gap,2);
  assert.equal(layout.dockHeight,230);
});

test('short portrait screens preserve a usable control dock',async()=>{
  const compute=await loadLayoutEngine();
  const layout=compute({width:480,height:560});

  assert.equal(layout.mode,'portrait');
  assert.equal(layout.boardSize,342);
  assert.equal(layout.dockHeight,180);
  assert.equal(layout.boardSize+layout.topStrip+layout.gap+layout.dockHeight,560);
});

test('landscape phones give the board the full viewport height',async()=>{
  const compute=await loadLayoutEngine();
  const layout=compute({width:844,height:390});

  assert.equal(layout.mode,'landscape');
  assert.equal(layout.boardSize,390);
  assert.equal(layout.topStrip,0);
  assert.equal(layout.gap,4);
  assert.equal(layout.dockWidth,203);
});

test('layout values are sanitized for an invalid viewport',async()=>{
  const compute=await loadLayoutEngine();
  const layout=compute({width:0,height:NaN});

  assert.equal(layout.width,1);
  assert.equal(layout.height,1);
  assert.ok(layout.boardSize>=1);
});

test('fullscreen controller applies adaptive landscape metrics to the live stage',async()=>{
  const result=await runFullscreenController({width:844,height:390,mainWidth:637,mainHeight:390});

  assert.equal(result.body.dataset.gameLayoutMode,'landscape');
  assert.equal(result.properties.get('--game-board-size'),'390px');
  assert.equal(result.properties.get('--game-top-strip'),'0px');
  assert.equal(result.properties.get('--game-dock-width'),'203px');
  assert.equal(result.layoutEvent?.type,'busraj:game-layout');
  assert.equal(result.layoutEvent?.detail?.mode,'landscape');
});

test('snake page loads the V4 cascade and adaptive controller in dependency order',async()=>{
  const html=await readFile(new URL('../public/snakes.html',import.meta.url),'utf8');
  const premium=html.indexOf('assets/css/snakes-premium.css');
  const v4=html.indexOf('assets/css/snakes-v4-board.css');
  const layout=html.indexOf('assets/js/adaptive-board-layout.js');
  const fullscreen=html.indexOf('assets/js/fullscreen-game.js');

  assert.ok(premium>=0&&v4>premium,'V4 board styling must win the CSS cascade');
  assert.ok(layout>=0&&fullscreen>layout,'layout engine must load before the fullscreen controller');
});
