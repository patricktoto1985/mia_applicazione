
const crypto = require('crypto');

const FOLDER_ID = '1X_VxnutbrkIS3m1i3PQAY-qoilO2Wnpj';

function autorizzato(req) {
  const secret = process.env.GOOGLE_OAUTH_SETUP_SECRET || '';
  const supplied = req.headers['x-grcc-setup-key'];

  if (!secret || typeof supplied !== 'string') return false;

  const a = Buffer.from(secret);
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

  if (!autorizzato(req)) {
    return res.status(403).json({
      ok: false,
      fase: 'sicurezza',
      errore: 'Chiave privata non valida'
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
      fase: 'configurazione',
      errore: 'Variabili Google mancanti'
    });
  }

  try {
    // 1. Aggiorna il token Google
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
        googleStatus: tokenResponse.status,
        googleError: tokenData.error || 'unknown',
        errore: 'Google non ha aggiornato il token'
      });
    }

    // 2. Verifica l'accesso alla cartella privata
    const url = new URL(
      'https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(FOLDER_ID)
    );

    url.searchParams.set(
      'fields',
      'id,name,mimeType,capabilities(canAddChildren)'
    );

    const driveResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const driveData = await driveResponse.json();

    if (!driveResponse.ok) {
      const googleError = driveData.error || {};

      return res.status(502).json({
        ok: false,
        fase: 'drive',
        googleStatus: driveResponse.status,
        googleReason:
          googleError.errors?.[0]?.reason || 'unknown',
        errore:
          driveResponse.status === 404
            ? 'Cartella non visibile con i permessi OAuth attuali'
            : driveResponse.status === 403
              ? 'Google Drive ha negato accesso alla cartella'
              : 'Errore durante la lettura della cartella'
      });
    }

    // 3. Restituisce soltanto dati non sensibili
    const isFolder =
      driveData.mimeType ===
      'application/vnd.google-apps.folder';

    return res.status(200).json({
      ok: isFolder,
      fase: 'completata',
      cartella: driveData.name,
      cartellaValida: isFolder,
      puoCaricare:
        driveData.capabilities?.canAddChildren === true
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      fase: 'connessione',
      errore: 'Errore di comunicazione con Google'
    });
  }
};
