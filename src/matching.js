'use strict';

/**
 * Pencocokan lawan yang tahan terhadap entri antrean "mati".
 *
 * Antrean tidak punya batas waktu, jadi sebuah entri bisa menunggu berjam-jam sementara
 * pemiliknya menutup DM, memblokir bot, atau menghapus akun. Bila pasangan yang menunggu
 * tidak bisa dihubungi, entrinya dibuang (join() sudah mengeluarkannya dari antrean) dan
 * pemain yang baru mencari langsung dicoba dengan pasangan berikutnya, bukan dibatalkan.
 *
 * @param {import('./matchmaker').Matchmaker} mm
 * @param {string} id  pemain yang mencari
 * @param {(partnerId: string) => Promise<boolean>} deliver  kirim kabar "terhubung" ke pasangan; false = tak terjangkau
 * @param {{maxAttempts?: number}} [opt]
 * @returns {Promise<{status:'cooldown'|'busy'|'queued'|'matched'|'failed', partnerId?:string, attempts?:number}>}
 *   `failed`: maxAttempts pasangan berturut-turut tak terjangkau (pemain tidak masuk antrean).
 */
async function matchOrQueue(mm, id, deliver, { maxAttempts = 5 } = {}) {
  let r = mm.join(id);
  if (r.status !== 'matched') return r; // cooldown | busy | queued
  for (let attempt = 1; ; attempt += 1) {
    let ok = false;
    try { ok = await deliver(r.partnerId); } catch (_) { ok = false; }
    if (ok) return r;
    mm.leave(id, { reason: 'unreachable' }); // chat kosong: tidak ada transkrip
    mm.cooldowns.delete(id);                 // percobaan ulang ini bukan /start baru dari pemain
    if (attempt >= maxAttempts) return { status: 'failed', attempts: attempt };
    r = mm.join(id);
    if (r.status !== 'matched') return r;    // tidak ada lagi yang menunggu: masuk antrean
  }
}

module.exports = { matchOrQueue };
