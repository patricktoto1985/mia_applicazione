// GRCC Google Drive health check. No tokens or Google error details exposed to clients.
const { access } = require('./_shared');
let cached = null;
let checkedAt = 0;
let inFlight = null;
async function check() {
  const token = await access();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID mancante');
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(folderId) + '?fields=id,mimeType,trashed&supportsAllDrives=true', {
    headers: {Authorization: 'Bearer ' + token}
  });
  if (!r.ok) throw new Error('Drive folder access: HTTP ' + r.status);
  const data = await r.json();
  if (data.trashed || data.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Cartella Drive non valida');
  return {ok:true};
}
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method !== 'GET') return res.status(405).json({ok:false});
  try {
    if (!cached || Date.now() - checkedAt > 5*60*1000) {
      if (!inFlight) inFlight = check().then(result => {cached=result;checkedAt=Date.now();return result}).finally(()=>{inFlight=null});
      await inFlight;
    }
    return res.status(200).json({ok:true});
  } catch (e) {
    console.error('GRCC Drive health:',e.message);
    cached=null;
    return res.status(503).json({ok:false});
  }
};
