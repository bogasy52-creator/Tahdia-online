import {Career} from '../career/core.js';
// Ownership is derived from the authenticated account record, never a client role.
export const OWNER_USERNAME='bosrag';
export const OWNER_CAPABILITIES=Object.freeze(['accounts.read','economy.manage','catalog.unlock','accounts.moderate','announcements.manage','audit.read']);
export function isOwner(profile){return String(profile?.username||'').normalize('NFKC').trim().toLowerCase()===OWNER_USERNAME}
export function accountAccess(profile){const owner=isOwner(profile);return {role:owner?'owner':'player',label:owner?'مدير الحلبة':'لاعب',allItems:owner,capabilities:owner?[...OWNER_CAPABILITIES]:[]}}
export function accountCareer(raw,profile){
 const p=Career.normalize(raw);
 if(isOwner(profile)){
  const first=!p.owned.includes('title-manager');p.owned=Career.CATALOG.map(i=>i.id);
  if(first&&p.equipped.title==='title-player')p.equipped.title='title-manager';
 }else{
  p.owned=p.owned.filter(id=>Career.CATALOG.find(i=>i.id===id)?.source!=='owner');
  if(p.equipped.title==='title-manager')p.equipped.title='title-player';
 }
 return Career.normalize(p);
}
