
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const required = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY'
  ];

  const configured = required.every(
    name => Boolean(process.env[name])
  );

  return res.status(configured ? 200 : 503).json({
    ok: configured,
    message: configured
      ? 'Configurazione Firebase presente su Vercel.'
      : 'Configurazione Firebase incompleta su Vercel.'
  });
};
