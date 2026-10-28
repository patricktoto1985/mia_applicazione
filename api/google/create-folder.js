
const crypto = require('crypto');

function authorized(req) {
  const expected = process.env.GOOGLE_OAUTH_SETUP_SECRET || '';
  const supplied = req.headers['x-grcc-setup-key'];

  if (!expected || typeof supplied !== 'string') return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);

  return a.length === b.length &&
    crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      errore: 'Metodo non consentito'
    });
  }

  if (!authorized(req)) {
    return res.status(403).json({
      ok: false,
      errore: 'Accesso negato'
    });
  }

  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN
  } = process.env;

  if (!GOOGLE_CLIENT_ID ||
      !GOOGLE_CLIENT_SECRET ||
      !GOOGLE_REFRESH_TOKEN) {
    return res.status(500).json({
      ok: false,
      errore: 'Configurazione Google incompleta'
    });
  }

  try {
    // Ottiene un access token tramite il refresh token
    const tokenResponse = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: GOOGLE_REFRESH_TOKEN,
          grant_type: 'refresh_token'
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(502).json({
        ok: false,
        fase: 'oauth',
        errore: 'Impossibile aggiornare il token Google'
      });
    }

    // Crea una cartella privata tramite Google Drive API
    const folderResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'GRCC F1 ESPORTS - Reclami Video',
          mimeType: 'application/vnd.google-apps.folder'
        })
      }
    );

    const folderData = await folderResponse.json();

    if (!folderResponse.ok) {
      return res.status(502).json({
        ok: false,
        fase: 'drive',
        googleStatus: folderResponse.status,
        googleReason:
          folderData.error?.errors?.[0]?.reason || 'unknown',
        errore: 'Google Drive non ha creato la cartella'
      });
    }

    return res.status(201).json({
      ok: true,
      messaggio: 'Cartella privata creata correttamente',
      folderId: folderData.id,
      nome: folderData.name,
      link: folderData.webViewLink ||
        `https://drive.google.com/drive/folders/${folderData.id}`
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      errore: 'Errore durante la creazione della cartella'
    });
  }
};
