import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const cfg=window.TAHDIA_FIREBASE_CONFIG;
if(cfg){
 const app=initializeApp(cfg);
 const auth=getAuth(app);
 const db=getFirestore(app);
 signInAnonymously(auth).then(async()=>{
   window.TahdiaOnline={db,addDoc,collection,serverTimestamp,getDocs};
   window.TahdiaMatchmaking.firebaseReady=true;
 }).catch(()=>{});
}
