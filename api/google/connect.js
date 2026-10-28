
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_OAUTH_SETUP_SECRET
  } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET ||
      !GOOGLE_REDIRECT_URI || !GOOGLE_OAUTH_SETUP_SECRET) {
    return res.status(500).json({
      error: 'Configurazione OAuth incompleta'
    });
  }

  const suppliedSecret = req.query.key || '';

  const expected = Buffer.from(GOOGLE_OAUTH_SETUP_SECRET);
  const supplied = Buffer.from(suppliedSecret);

  if (
    expected.length !== supplied.length ||
    !crypto.timingSafeEqual(expected, supplied)
  ) {
    return res.status(403).json({ error: 'Accesso negato' });
  }

  const state = crypto.randomBytes(24).toString('hex');

  res.setHeader(
    'Set-Cookie',
    `grcc_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/google; Max-Age=600`
  );

  res.setHeader('Cache-Control', 'no-store');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
    state
  });

  return res.redirect(
    302,
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
};
