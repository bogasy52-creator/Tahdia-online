window.TahdiaMatchmaking={
 firebaseReady:false,queue:false,watch:null,
 join(){
  if(this.queue)return;
  this.queue=true;
  const old=document.getElementById('matchBox'); if(old)old.remove();
  const box=document.createElement('div'); box.id='matchBox';
  box.className='bs-panel';
  box.style='position:fixed;inset:15%;z-index:9999;padding:28px;text-align:center;display:grid;place-content:center;gap:12px';
  box.innerHTML=`<div style="font-size:48px">⚡</div><h2>البحث عن منافس</h2><p id="matchText">جاري الاتصال...</p><button class="bs-btn" id="cancelMatch">إلغاء</button>`;
  document.body.appendChild(box);
  try{window.BS_AUDIO?.play('duel')}catch(e){}
  const t=box.querySelector('#matchText');
  box.querySelector('#cancelMatch').onclick=()=>{this.queue=false;if(this.watch)clearInterval(this.watch);box.remove();};
  const start=async()=>{
   if(!window.TahdiaOnline){
    t.textContent='جاري تجهيز الاتصال...'; return;
   }
   t.textContent='تم تسجيلك في قائمة الانتظار...';
   const api=window.TahdiaOnline;
   const me=await api.addDoc(api.collection(api.db,'match_queue'),{
    createdAt:api.serverTimestamp(),status:'waiting'
   });
   t.textContent='نبحث عن لاعب...';
   // Polling fallback for simple Firestore setup
   this.watch=setInterval(async()=>{
    try{
     const snap=await api.getDocs(api.collection(api.db,'match_queue'));
     let other=null;
     snap.forEach(d=>{if(d.id!==me.id && d.data().status==='waiting'&&!other) other=d;});
     if(other){
       clearInterval(this.watch);
       this.queue=false;
       t.textContent='تم العثور على منافس!';
       try{window.BS_AUDIO?.play('round')}catch(e){}
       setTimeout(()=>{location.href='online.html?match='+other.id;},900);
     }
    }catch(e){t.textContent='تعذر الاتصال...';}
   },3000);
  };
  start();
 }
};
