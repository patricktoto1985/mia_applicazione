
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    return res.status(405).send('Metodo non consentito');
  }

  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res.status(500).send('Configurazione OAuth incompleta');
  }

  const cookies = Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map(part => {
        const index = part.indexOf('=');
        if (index < 0) return ['', ''];
        return [
          part.slice(0, index).trim(),
          part.slice(index + 1).trim()
        ];
      })
      .filter(([key]) => key)
  );

  const state = typeof req.query.state === 'string'
    ? req.query.state
    : '';

  const savedState = cookies.grcc_oauth_state || '';

  const a = Buffer.from(state);
  const b = Buffer.from(savedState);

  const validState =
    a.length > 0 &&
    a.length === b.length &&
    crypto.timingSafeEqual(a, b);

  res.setHeader(
    'Set-Cookie',
    'grcc_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=0'
  );

  if (!validState) {
    return res.status(403).send(
      'Autorizzazione non valida o scaduta. Ricomincia dal collegamento Google.'
    );
  }

  if (req.query.error) {
    return res.status(400).send('Google ha rifiutato autorizzazione.');
  }

  const code = typeof req.query.code === 'string'
    ? req.query.code
    : '';

  if (!code) {
    return res.status(400).send('Codice autorizzazione mancante.');
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(502).send(
        'Google non ha completato autorizzazione. Riprova.'
      );
    }

    if (!result.refresh_token) {
      return res.status(409).send(
        'Google non ha restituito un refresh token. ' +
        'Riprova la procedura con consenso esplicito.'
      );
    }

    const token = result.refresh_token;

    // Il token non viene salvato nei log o nel repository.
    // Viene mostrato solo in questa risposta HTTPS.
    const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow">
<title>GRCC - Collegamento Google Drive</title>
<style>
body {
  font-family: Arial, sans-serif;
  background: #101827;
  color: white;
  padding: 35px;
  max-width: 750px;
  margin: auto;
}
textarea {
  width: 100%;
  box-sizing: border-box;
  height: 115px;
  padding: 12px;
  margin-top: 15px;
  font-size: 14px;
}
code { color: #9be5ff; }
</style>
</head>
<body>
<h2>Google Drive autorizzato</h2>
<p>Salva il seguente valore in Vercel come
<code>GOOGLE_REFRESH_TOKEN</code>.</p>
<p><strong>Non inviarlo in chat e non pubblicarlo su GitHub.</strong></p>
<textarea readonly id="token"></textarea>
<p>Dopo averlo salvato, chiudi questa scheda.</p>
<script>
document.getElementById('token').value =
  ${JSON.stringify(token).replace(/</g, '\\u003c')};
</script>
</body>
</html>`;

    return res.status(200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(html);

  } catch (error) {
    console.error('Errore callback OAuth:', error.message);
    return res.status(500).send(
      'Errore durante il collegamento con Google Drive.'
    );
  }
};
