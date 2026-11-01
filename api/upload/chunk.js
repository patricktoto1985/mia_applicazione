const {unseal, seal, access, fail} = require('./_shared');
module.exports.config = {
  api: {
    bodyParser: false
  }
};
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const s = unseal(req.headers['x-grcc-upload-token']);
    const startHeader = req.headers['x-grcc-start'];
    const totalHeader = req.headers['x-grcc-total'];
    const start = Number(startHeader);
    const total = Number(totalHeader);
    const expectedSize = Number(s.size);
    // Limite prudente sotto il massimo payload delle funzioni Vercel.
    const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
    const chunks = [];
    let receivedBytes = 0;
    for await (const b of req) {
      receivedBytes += b.length;
      if (receivedBytes > MAX_CHUNK_BYTES) {
        throw Error('Blocco troppo grande: massimo 4 MB per richiesta');
      }
      chunks.push(b);
    }
    const buf = Buffer.concat(chunks);

    console.log('GRCC UPLOAD CHECK', {
      start, total, expectedSize, receivedBytes: buf.length,
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type'],
      bodyAlreadyParsed: req.body !== undefined
    });

    if (startHeader === undefined || !Number.isSafeInteger(start) || start < 0) {
      throw Error('Blocco non valido: posizione iniziale mancante o errata');
    }
    if (totalHeader === undefined || !Number.isSafeInteger(total) || total < 1 ||
        !Number.isSafeInteger(expectedSize) || total !== expectedSize) {
      throw Error('Blocco non valido: dimensione totale diversa da quella autorizzata');
    }
    if (buf.length === 0) {
      throw Error('Blocco non valido: il server ha ricevuto zero byte');
    }
    if (start + buf.length > total) {
      throw Error('Blocco non valido: i dati superano la dimensione del video');
    }
    if (start % 262144 !== 0 ||
        (start + buf.length !== total && buf.length % 262144 !== 0)) {
      throw Error('Allineamento blocco errato: utilizzare multipli di 256 KB');
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
