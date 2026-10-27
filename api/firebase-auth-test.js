
const { createSign } = require('node:crypto');

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !email || !rawKey) {
    return res.status(503).json({
      ok: false,
      message: 'Variabili Firebase mancanti'
    });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({
      alg: 'RS256',
      typ: 'JWT'
    }));

    const payload = base64url(JSON.stringify({
      iss: email,
      sub: email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 300,
      scope: 'https://www.googleapis.com/auth/firebase.messaging'
    }));

    const content = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(content);
    signer.end();

    const key = rawKey.replace(/\\n/g, '\n');
    const assertion = `${content}.${signer.sign(key).toString('base64url')}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      })
    });

    const data = await response.json();

    return res.status(response.ok && data.access_token ? 200 : 502).json({
      ok: Boolean(response.ok && data.access_token),
      message: response.ok && data.access_token
        ? 'Autenticazione Firebase riuscita'
        : 'Credenziali non accettate'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Errore durante la verifica Firebase'
    });
  }
};
