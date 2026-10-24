// Execute the actual new storefront and shared art, never a legacy test facade.
export async function loadAtelier(h){
 if(!h.context.BS_CAREER_CORE)await h.runFile('assets/js/profile-core.js');
 await h.runFile('assets/js/pro-dice.js');
 await h.runFile('assets/js/atelier-shop-v30.js');
 return h;
}
