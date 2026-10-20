import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';

test('an old dashboard response cannot replace a newly signed-in account',async()=>{
 let finishOld;const old=new Promise(resolve=>finishOld=resolve);
 const response=data=>({ok:true,status:200,json:async()=>data});
 const h=await createDOM('social.html',{EventTarget,fetch:async(path)=>path==='/api/social/login'?response({ok:true,token:'newuser.'+'B'.repeat(43),profile:{username:'newuser',displayName:'New'}}):old});
 // The app harness uses a real EventTarget; use its matching Event type.
 h.context.CustomEvent=class extends Event{constructor(type,init){super(type);this.detail=init?.detail;}};
 h.storage.set('bs_social_session','olduser.'+'A'.repeat(43));
 h.storage.set('bs_social_profile',JSON.stringify({username:'olduser'}));
 await h.runFile('assets/js/social-client.js');
 await h.context.BS_SOCIAL.login({username:'newuser',password:'test-only-password'});
 finishOld(response({ok:true,profile:{username:'olduser'},notifications:[],friends:[]}));
 await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(h.context.BS_SOCIAL.profile().username,'newuser');
 assert.equal(JSON.parse(h.storage.get('bs_social_profile')).username,'newuser');
});

test('a cross-tab account change removes the old accounts visible invitation',async()=>{
 const invite={id:'account-a-invite',type:'game_invite',game:'snakes',joinPath:'/snakes?room=123456',roomCode:'123456',createdAt:Date.now(),expiresAt:Date.now()+60000,read:false};
 const h=await createDOM('social.html',{EventTarget,fetch:async(_path,options)=>{const username=options.headers.get('authorization').split(' ')[1].split('.')[0];return{ok:true,status:200,json:async()=>({ok:true,profile:{username},notifications:username==='alice'? [invite]:[],friends:[]})};}});
 h.context.CustomEvent=class extends Event{constructor(type,init){super(type);this.detail=init?.detail;}};
 h.storage.set('bs_social_session','alice.'+'A'.repeat(43));h.storage.set('bs_social_profile',JSON.stringify({username:'alice'}));
 await h.runFile('assets/js/social-client.js');await new Promise(resolve=>setTimeout(resolve,5));
 assert.ok(h.doc.getElementById('bsSocialInvite'));
 h.storage.set('bs_social_session','bob.'+'B'.repeat(43));h.storage.set('bs_social_profile',JSON.stringify({username:'bob'}));
 h.context.dispatchEvent({type:'storage',key:'bs_social_session'});
 assert.equal(h.doc.getElementById('bsSocialInvite'),null);
 assert.equal(h.context.BS_SOCIAL.profile().username,'bob');
});
