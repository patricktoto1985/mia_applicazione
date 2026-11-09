// GRCC: authenticated server-to-server FCM v1 sender. Never call from a browser.
const crypto = require('node:crypto');
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PROJECT = process.env.FIREBASE_PROJECT_ID;
function b64(x) { return Buffer.from(JSON.stringify(x)).toString('base64url'); }
async function googleToken() {
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!PROJECT || !email || !key) throw new Error('Firebase server credentials missing');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({alg:'RS256',typ:'JWT'}) + '.' + b64({iss:email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:TOKEN_URL,iat:now,exp:now+3600});
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url');
  const r = await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+sig})});
  if(!r.ok) throw new Error('Google OAuth token HTTP '+r.status);
  const data = await r.json();
  if(!data.access_token) throw new Error('Google OAuth missing token');
  return data.access_token;
}
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).json({ok:false});
  const expected = process.env.GRCC_MONITOR_SECRET;
  const supplied = req.headers['x-grcc-monitor-secret'];
  if(!expected || typeof supplied !== 'string' || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return res.status(401).json({ok:false});
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || body.user !== "TOTO'F1" || !['OFFLINE','ONLINE','TEST'].includes(body.status) || !Array.isArray(body.tokens) || body.tokens.length < 1 || body.tokens.length > 5 || body.tokens.some(t => typeof t !== 'string' || t.length < 50 || t.length > 4096)) return res.status(400).json({ok:false});
    const access = await googleToken();
    const title = body.status === 'OFFLINE' ? 'GRCC: Google Drive non operativo' : body.status === 'ONLINE' ? 'GRCC: Google Drive ripristinato' : 'GRCC: notifica di prova';
    const message = body.status === 'OFFLINE' ? 'Il monitor ha rilevato due controlli falliti. Verifica i caricamenti.' : body.status === 'ONLINE' ? 'Il controllo Google Drive è tornato operativo.' : 'Le notifiche del monitor Google Drive funzionano.';
    const results = await Promise.all(body.tokens.map(async token => {
      const r = await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(PROJECT)+'/messages:send',{
        method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
        body:JSON.stringify({message:{token,notification:{title,body:message},webpush:{fcm_options:{link:'https://grccf1esport.vercel.app/'}}}})
      });
      return r.ok;
    }));
    if(results.some(x => !x)) { console.error('GRCC FCM: some deliveries rejected'); return res.status(502).json({ok:false,sent:results.filter(Boolean).length}); }
    return res.status(200).json({ok:true,sent:results.length});
  } catch(e) { console.error('GRCC monitor send:',e.message); return res.status(500).json({ok:false}); }
};
