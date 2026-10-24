// Execute the actual new storefront and shared art, never a legacy test facade.
export async function loadAtelier(h){
 if(!h.context.BS_CAREER_CORE)await h.runFile('assets/js/profile-core.js');
 await h.runFile('assets/js/pro-dice.js');
 await h.runFile('assets/js/pieces-v31.js');
 await h.runFile('assets/js/shop-v31.js');
 return h;
}
