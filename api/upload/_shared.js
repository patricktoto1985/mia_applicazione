const crypto=require('crypto');
const SCRIPT='https://script.google.com/macros/s/AKfycbz30o3f7QkmijHWpQgwInJMIcIujmO_F070OwXhqbKnQidHdJC4iLa-rQZy0WzsN9buuA/exec';
const key=()=>{if(!process.env.GRCC_UPLOAD_SIGNING_SECRET||process.env.GRCC_UPLOAD_SIGNING_SECRET.length<32)throw Error('GRCC_UPLOAD_SIGNING_SECRET non configurato');return crypto.createHash('sha256').update(process.env.GRCC_UPLOAD_SIGNING_SECRET).digest()};
function seal(obj){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([c.update(JSON.stringify(obj)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64url')}
function unseal(s){const b=Buffer.from(s||'','base64url'),d=crypto.createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));const o=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());if(!o.exp||Date.now()>o.exp)throw Error('Sessione upload scaduta');return o}
async function access(){const body=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:process.env.GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token'});const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body});const j=await r.json();if(!r.ok)throw Error('Google OAuth: '+(j.error||r.status));return j.access_token}
function fail(res,e){res.status(400).json({ok:false,error:e.message||String(e)})}
module.exports={SCRIPT,seal,unseal,access,fail};
