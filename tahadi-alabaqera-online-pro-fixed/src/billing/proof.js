const encoder=new TextEncoder();
const content=claim=>JSON.stringify([claim.username,claim.invoiceId,claim.item,claim.amount]);
async function key(secret){if(!secret)throw Error('billing_not_configured');return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signBillingGrant(secret,claim){const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(content(claim))));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyBillingGrant(secret,claim,proof){if(!secret||typeof proof!=='string'||!/^\w{64}$/.test(proof)||!/^[a-f0-9]+$/.test(proof))return false;const bytes=Uint8Array.from(proof.match(/../g),x=>parseInt(x,16));return crypto.subtle.verify('HMAC',await key(secret),bytes,encoder.encode(content(claim)));}
