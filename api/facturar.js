'use strict';
// Endpoint de facturación para la DEMO del POS (modo prueba, sin tocar ARCA).
// Corre como función serverless en Vercel, en el mismo dominio que el sitio,
// así el botón "Facturar" de pos.html lo llama con fetch('/api/facturar').
// El motor real y reutilizable (contra ARCA) vive en el repo jpunto-facturacion.

// Numeración best-effort: se mantiene mientras la función esté "caliente"
// y se reinicia en un cold start. Alcanza para la demo.
let contador = {};

function buildQrUrl({ fecha, cuit, ptoVta, tipoCmp, nroCmp, importe, tipoDocRec, nroDocRec, cae }) {
  const data = {
    ver: 1, fecha, cuit: Number(cuit), ptoVta: Number(ptoVta),
    tipoCmp: Number(tipoCmp), nroCmp: Number(nroCmp), importe: Number(importe),
    moneda: 'PES', ctz: 1, tipoDocRec: Number(tipoDocRec), nroDocRec: Number(nroDocRec),
    tipoCodAut: 'E', codAut: Number(cae),
  };
  const b64 = Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
  return 'https://www.afip.gob.ar/fe/qr/?p=' + b64;
}
function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Usá POST' }); return; }

  let venta = req.body;
  if (typeof venta === 'string') { try { venta = JSON.parse(venta); } catch (e) { venta = {}; } }
  venta = venta || {};
  const items = Array.isArray(venta.items) ? venta.items : [];
  const total = Math.round(Number(venta.total) || 0);
  if (!items.length || !total) { res.status(400).json({ error: 'Faltan items o total' }); return; }

  // Comercio Demo = monotributo -> Factura C (no discrimina IVA)
  const cuit = 30711234567, ptoVta = 1, tipoCmp = 11;
  const k = ptoVta + '-' + tipoCmp;
  contador[k] = (contador[k] || 48) + 1;
  const nro = contador[k];

  const now = new Date();
  const fecha = now.toISOString().slice(0, 10);
  const caeVto = new Date(now.getTime() + 10 * 86400000).toISOString().slice(0, 10);
  let cae = ''; for (let i = 0; i < 14; i++) cae += Math.floor(Math.random() * 10);

  const qrUrl = buildQrUrl({
    fecha, cuit, ptoVta, tipoCmp, nroCmp: nro, importe: total,
    tipoDocRec: 99, nroDocRec: 0, cae,
  });

  res.status(200).json({
    modo: 'demo',
    emisor: { razonSocial: 'Comercio Demo', cuit, condicion: 'monotributo' },
    comprobante: {
      tipo: tipoCmp, letra: 'C', ptoVta, numero: nro,
      numeroFmt: pad(ptoVta, 4) + '-' + pad(nro, 8), fecha,
    },
    receptor: { condicion: 'consumidor_final' },
    importes: { neto: total, iva: 0, total },
    items, cae, caeVto, qrUrl,
  });
};
