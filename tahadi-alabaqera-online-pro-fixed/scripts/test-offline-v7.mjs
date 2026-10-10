import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.env.PRO_QA_OUTPUT||'qa-results');await mkdir(output,{recursive:true});
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
await import('./play-local.mjs');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:process.env.PRO_QA_SINGLE_PROCESS==='1'?['--no-sandbox','--single-process','--no-zygote']:[]});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),checks=[];
try{
 await page.goto('http://localhost:4173/');await page.waitForFunction(async()=>{await navigator.serviceWorker.ready;return navigator.serviceWorker.controller!==null},{},{timeout:20000});
 const cached=await page.evaluate(async()=>{const c=await caches.open('busraj-games-v25-pro-v7');return (await c.keys()).length});assert.ok(cached>=225);checks.push('All 225 shell paths cached');
 await context.setOffline(true);
 for(const route of ['snakes','jackaroo','zahra','dice','shop']){
  await page.goto('http://localhost:4173/'+route);await page.waitForFunction(()=>window.BS_PRO&&window.BS_CAREER);
  if(route==='shop'){assert.equal(await page.locator('.store-card').count(),24)}
  else{await page.locator('#startBtn').click();if(route==='jackaroo')await page.locator('#revealHand').click();else{await page.evaluate(()=>{BS_DICE.random=()=>2;BS_DICE.unit=()=>.9});await page.locator('#roll').click();await page.waitForFunction(()=>!document.getElementById('roll').disabled)}}
  checks.push('Offline usable '+route);console.log('PASS Offline usable '+route);
 }
 const keys=await page.evaluate(async()=>{const c=await caches.open('busraj-games-v25-pro-v7');return (await c.keys()).map(r=>new URL(r.url).pathname)});assert.equal(keys.some(key=>key.startsWith('/api/')),false);checks.push('API replies are never cached');
 await writeFile(resolve(output,'offline-result.json'),JSON.stringify({checks,cached},null,2));await browser.close();process.exit(0);
}catch(error){console.error(error);await browser.close();process.exit(1)}
