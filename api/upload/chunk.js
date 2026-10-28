const {unseal, seal, access, fail} = require('./_shared');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const s = unseal(req.headers['x-grcc-upload-token']);
    const start = Number(req.headers['x-grcc-start']);
    const total = Number(req.headers['x-grcc-total']);
    const chunks = [];
    for await (const b of req) chunks.push(b);
    const buf = Buffer.concat(chunks);

    if (!Number.isSafeInteger(start) || start < 0 || total !== s.size ||
        buf.length < 1 || buf.length > 1024 * 1024 || start + buf.length > total) {
      throw Error('Blocco non valido');
    }
    if (start % 262144 !== 0 ||
        (start + buf.length !== total && buf.length % 262144 !== 0)) {
      throw Error('Allineamento blocco errato');
    }

    const r = await fetch(s.location, {
      method: 'PUT',
      headers: {
        'Content-Length': String(buf.length),
        'Content-Range': `bytes ${start}-${start + buf.length - 1}/${total}`
      },
      body: buf
    });
    if (r.status === 308) return res.json({ok: true, done: false});
    if (!r.ok) throw Error('Drive upload HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));

    const j = await r.json();
    if (!j.id) throw Error('Drive non ha confermato il file');

    // Il file e' stato creato dall'app: abilita la sola lettura tramite link.
    const googleToken = await access();
    const permissionResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(j.id) +
      '/permissions?fields=id&type=anyone',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + googleToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({type: 'anyone', role: 'reader', allowFileDiscovery: false})
      }
    );

    if (!permissionResponse.ok) {
      const details = (await permissionResponse.text()).slice(0, 250);
      throw Error('Video caricato su Drive, ma condivisione pubblica non riuscita: HTTP ' +
        permissionResponse.status + ' ' + details);
    }

    return res.json({
      ok: true,
      done: true,
      receipt: seal({id: j.id, pilota: s.pilota, exp: Date.now() + 12 * 60 * 60 * 1000})
    });
  } catch (e) {
    return fail(res, e);
  }
};
