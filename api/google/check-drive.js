
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const secret = process.env.GOOGLE_OAUTH_SETUP_SECRET || '';
  const provided = req.headers['x-grcc-setup-key'] || '';

  const a = Buffer.from(secret);
  const b = Buffer.from(typeof provided === 'string' ? provided : '');

  if (!a.length || a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN
  } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return res.status(500).json({ error: 'Credenziali Google incomplete' });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(502).json({
        ok: false,
        fase: 'oauth',
        error: 'Impossibile aggiornare il token Google'
      });
    }

    const folderId = '1X_VxnutbrkIS3m1i3PQAY-qoilO2Wnpj';

    const driveResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(folderId) +
      '?fields=id,name,mimeType,capabilities(canAddChildren)',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    if (!driveResponse.ok) {
      return res.status(502).json({
        ok: false,
        fase: 'drive',
        error: 'Google Drive non consente di leggere la cartella',
        googleStatus: driveResponse.status
      });
    }

    const folder = await driveResponse.json();

    return res.status(200).json({
      ok: folder.mimeType === 'application/vnd.google-apps.folder',
      cartella: folder.name,
      puoCaricare: folder.capabilities?.canAddChildren === true
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Errore durante la verifica'
    });
  }
};
