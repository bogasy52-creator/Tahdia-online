window.TahdiaMatchmaking={
 firebaseReady:false,queue:false,watch:null,me:null,
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

  const run=async()=>{
   const api=window.TahdiaOnline;
   if(!api){
    t.textContent='جاري تشغيل الاتصال...';
    setTimeout(run,500);
    return;
   }
   try{
    const player=JSON.parse(localStorage.getItem('tahadi-player')||'{}');
    const me=await api.addDoc(
      api.collection(api.db,'match_queue'),
      {
       name:player.name||'لاعب',
       status:'waiting',
       createdAt:api.serverTimestamp()
      }
    );
    this.me=me.id;
    t.textContent='تم الدخول، نبحث عن لاعب...';

    this.watch=setInterval(async()=>{
      const snap=await api.getDocs(api.collection(api.db,'match_queue'));
      let other=null;
      snap.forEach(d=>{
       const x=d.data();
       if(d.id!==me.id && x.status==='waiting' && !other) other=d;
      });
      if(other){
       clearInterval(this.watch);
       await api.addDoc(api.collection(api.db,'matches'),{
        players:[me.id,other.id],
        createdAt:api.serverTimestamp()
       });
       this.queue=false;
       t.textContent='تم العثور على منافس!';
       try{window.BS_AUDIO?.play('round')}catch(e){}
       setTimeout(()=>location.href='online.html?match='+other.id,800);
      }
    },2000);
   }catch(e){
    t.textContent='خطأ اتصال: '+e.message;
    this.queue=false;
   }
  };
  run();
 }
};
