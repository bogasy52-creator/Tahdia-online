import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const cfg=window.TAHDIA_FIREBASE_CONFIG;
if(cfg){
 const app=initializeApp(cfg);
 const auth=getAuth(app);
 const db=getFirestore(app);
 // Make Firestore available even if anonymous auth is not enabled yet
 window.TahdiaOnline={db,addDoc,collection,serverTimestamp,getDocs};
 signInAnonymously(auth)
  .then(()=>{ window.TahdiaOnline.authReady=true; window.TahdiaOnlineError=null; })
  .catch((e)=>{ window.TahdiaOnlineError=e.message; });
}else{
 window.TahdiaOnlineError='Firebase config missing';
}
