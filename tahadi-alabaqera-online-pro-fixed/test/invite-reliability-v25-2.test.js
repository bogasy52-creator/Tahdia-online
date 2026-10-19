import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('invite inbox falls back to server-stored notifications after reconnect and return',async()=>{
 const source=await load('public/assets/js/social-client.js');
 for(const token of ['INBOX_INTERVAL_MS','syncInbox(data)','!n.read','showIncomingInvite(latest)','visibilitychange','onopen =','refreshInbox()','startInbox()'])assert.ok(source.includes(token),token);
 assert.match(source,/readNotifications\(\[notification.id\]\)/);
});
test('rooms toolbar stays in document flow on mobile paths match',async()=>{
 const css=await load('public/assets/css/play-experience-v25.css');
 assert.match(css,/\.paths-online-page \.bs-game-command\{position:relative!important/);
 assert.match(css,/\.bs-game-command\{position:relative;top:auto;/);
});
test('no misleading live-room invitation after match begins',async()=>{
 const source=await load('public/assets/js/play-feedback-v24-1.js');
 assert.match(source,/إذا بدأت المباراة فلا يمكن الانضمام/);
 assert.match(source,/invite\.textContent=data\.joinable\?'دعوة للغرفة':'تحدَّ صديقًا'/);
});

test('offline recipient sees persisted invitation on next dashboard read (isolated client harness)', async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=await load('public/assets/js/social-client.js');
 const cache=new Map([['bs_social_session','recipient.secret'],['bs_social_profile',JSON.stringify({username:'recipient',displayName:'Rec'})]]);
 const localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)};
 const byId=new Map();
 class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.classList={add(){},remove(){},toggle(){}};this.textContent='';}
  append(...nodes){for(const node of nodes){this.children.push(node);if(node.id)byId.set(node.id,node);} }
  appendChild(n){this.append(n);return n;}
  remove(){byId.delete(this.id);}
  setAttribute(){}
  addEventListener(){}
  querySelectorAll(){return [];}
  set innerHTML(_value){this.children=[];}
 }
 const document={body:new Element('body'),hidden:false,createElement:tag=>new Element(tag),querySelector:q=>q.startsWith('#')?byId.get(q.slice(1))||null:null,querySelectorAll:()=>[],addEventListener:()=>{}};
 const notifications=[{id:'inv-one',type:'game_invite',game:'paths',roomCode:'123456',joinPath:'/paths-online?room=123456',createdAt:Date.now(),expiresAt:Date.now()+60000,read:false,from:{displayName:'Friend'}}];
 let reads=0;
 const fetch=async(_path)=>({ok:true,status:200,json:async()=>{reads++;return {ok:true,profile:{username:'recipient',displayName:'Rec'},notifications,unread:1,friends:[]};}});
 const window={addEventListener(){},dispatchEvent(){},WebSocket:undefined};
 class CE extends Event{constructor(name,options){super(name);this.detail=options?.detail;}}
 runInNewContext(source,{window,document,localStorage,Headers,fetch,EventTarget,CustomEvent:CE,console,location:{protocol:'https:',host:'game.test'},setTimeout:()=>1,setInterval:()=>1,clearTimeout(){},clearInterval(){},Date,JSON,Number,Error,Promise});
 await new Promise(resolve=>setTimeout(resolve,40));
 const card=byId.get('bsSocialInvite');
 assert.ok(reads>0,'dashboard polled even without WebSocket');
 assert.ok(card,'saved invite appears in-game');
 assert.ok(card.children.some(x=>x.textContent.includes('دعوة من Friend')));
 assert.equal(card.children.find(x=>x.className==='bs-social-invite-actions').children[0].href,'/paths-online?room=123456');
 assert.ok((cache.get('bs_seen_invites_v25_2:recipient')||'').includes('inv-one'));
});
