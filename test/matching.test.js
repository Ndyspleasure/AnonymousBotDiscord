'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PGlite } = require('@electric-sql/pglite');
const { PgStore } = require('../src/store');
const { Matchmaker } = require('../src/matchmaker');
const { matchOrQueue } = require('../src/matching');
const config = require('../config');
const { msg } = require('../src/messages');

const quiet = { error() {} };
const alwaysOk = async () => true;
const H = 3600_000;

test('pencarian tanpa batas waktu: antrean tidak pernah kedaluwarsa sendiri', () => {
  assert.strictEqual(config.limits.queueTimeoutMs, 0);
  let t = 1_000_000;
  const mm = new Matchmaker(() => t);
  mm.join('a');
  t += 10 * 24 * H;
  const r = mm.sweep();
  assert.deepEqual(r.queueExpired, []);
  assert.ok(mm.isQueued('a'), 'masih mencari setelah 10 hari');
  // lalu tetap bisa dipasangkan
  assert.equal(mm.join('b').status, 'matched');
});

test('batas antrean tetap bisa dinyalakan lewat config (> 0)', () => {
  const asli = config.limits.queueTimeoutMs;
  try {
    config.limits.queueTimeoutMs = 5 * 60_000;
    let t = 1_000_000;
    const mm = new Matchmaker(() => t);
    mm.join('a');
    t += 5 * 60_000 + 1;
    assert.deepEqual(mm.sweep().queueExpired, ['a']);
    assert.ok(msg('queued').includes('5 menit'), 'pesan mengikuti config');
    assert.ok(!msg('queued').includes('tanpa batas waktu'));
  } finally { config.limits.queueTimeoutMs = asli; }
});

test('pesan antrean jujur soal restart: tersimpan di database vs tanpa penyimpanan', () => {
  const durable = msg('queued', { durable: true });
  const memori = msg('queued', { durable: false });
  assert.ok(durable.includes('tersimpan') && durable.includes('tidak hilang bila bot restart'));
  assert.ok(memori.includes('tanpa penyimpanan') && memori.includes('/start'));
  assert.ok(!memori.includes('tidak hilang'), 'tidak menjanjikan hal yang tidak benar tanpa database');
  assert.ok(msg('resumedQueue').includes('dilanjutkan') && msg('resumedQueue').includes('/stop'));
});

test('pasangan langsung terhubung: deliver dipanggil sekali', async () => {
  const mm = new Matchmaker();
  mm.join('a');
  const calls = [];
  const r = await matchOrQueue(mm, 'x', async (p) => { calls.push(p); return true; });
  assert.equal(r.status, 'matched'); assert.equal(r.partnerId, 'a'); assert.deepEqual(calls, ['a']);
  assert.equal(mm.partnerOf('x'), 'a');
});

test('tidak ada yang menunggu: pemain masuk antrean tanpa memanggil deliver', async () => {
  const mm = new Matchmaker();
  let dipanggil = 0;
  const r = await matchOrQueue(mm, 'x', async () => { dipanggil += 1; return true; });
  assert.equal(r.status, 'queued'); assert.equal(dipanggil, 0); assert.ok(mm.isQueued('x'));
});

test('pasangan yang menunggu tak terjangkau: dibuang, pemain baru masuk antrean (tidak ditolak)', async () => {
  const mm = new Matchmaker();
  mm.join('mati');
  const r = await matchOrQueue(mm, 'x', async () => false);
  assert.equal(r.status, 'queued', 'dulu pemain ditolak, sekarang tetap mencari');
  assert.ok(mm.isQueued('x')); assert.ok(!mm.isQueued('mati')); assert.equal(mm.partnerOf('x'), null);
});

test('beberapa entri mati berturut-turut dilewati sampai ketemu yang hidup', async () => {
  const mm = new Matchmaker();
  mm.restore({ queue: [{ userId: 'mati1', joinedAt: 1 }, { userId: 'mati2', joinedAt: 2 }, { userId: 'hidup', joinedAt: 3 }] });
  const tried = [];
  const r = await matchOrQueue(mm, 'x', async (p) => { tried.push(p); return p === 'hidup'; });
  assert.equal(r.status, 'matched'); assert.equal(r.partnerId, 'hidup');
  assert.deepEqual(tried, ['mati1', 'mati2', 'hidup'], 'urutan antrean (yang paling lama dulu)');
  assert.equal(mm.partnerOf('x'), 'hidup');
  assert.ok(!mm.isQueued('mati1') && !mm.isQueued('mati2'));
});

test('terlalu banyak entri mati: berhenti setelah maxAttempts dan tidak menggantung', async () => {
  const mm = new Matchmaker();
  mm.restore({ queue: Array.from({ length: 8 }, (_, i) => ({ userId: `m${i}`, joinedAt: i })) });
  const r = await matchOrQueue(mm, 'x', async () => false, { maxAttempts: 3 });
  assert.equal(r.status, 'failed'); assert.equal(r.attempts, 3);
  assert.equal(mm.partnerOf('x'), null); assert.ok(!mm.isQueued('x'), 'tidak masuk antrean bila gagal');
  assert.equal(mm.queue.size, 5, 'hanya yang dicoba yang dibuang');
});

test('deliver yang melempar error diperlakukan sebagai tak terjangkau, tidak merusak bot', async () => {
  const mm = new Matchmaker();
  mm.join('a');
  const r = await matchOrQueue(mm, 'x', async () => { throw new Error('Cannot send messages to this user'); });
  assert.equal(r.status, 'queued'); assert.ok(mm.isQueued('x'));
});

test('cooldown dan busy diteruskan apa adanya tanpa deliver', async () => {
  const t = 1_000_000;
  const mm = new Matchmaker(() => t);
  mm.join('x'); // masuk antrean
  assert.equal((await matchOrQueue(mm, 'x', alwaysOk)).status, 'busy');
  mm.leave('x');
  assert.equal((await matchOrQueue(mm, 'x', alwaysOk)).status, 'cooldown', 'jeda anti-spam 5 detik tetap berlaku');
});

// ─── Ketahanan saat bot restart ─────────────────────────────────────────────
async function freshStore() {
  const db = new PGlite();
  const store = new PgStore(db, quiet);
  await store.init();
  return { db, store };
}

test('restart: pencarian tersimpan dan dilanjutkan, pemain berikutnya langsung terhubung dengannya', async () => {
  const { store } = await freshStore();
  const t = 2_000_000;
  const sebelum = new Matchmaker(() => t, store);
  sebelum.join('menunggu');
  await store.flush();

  // "restart": Matchmaker baru memuat dari database
  const sesudah = new Matchmaker(() => t + 3 * H, store);
  const pulih = sesudah.restore(await store.load(config.limits.transcriptMaxEntries));
  assert.deepEqual(pulih.queued, ['menunggu'], 'dilaporkan agar bisa diberi tahu');
  assert.ok(sesudah.isQueued('menunggu'));
  const r = await matchOrQueue(sesudah, 'baru', alwaysOk);
  assert.equal(r.status, 'matched'); assert.equal(r.partnerId, 'menunggu');
  await store.flush();
  assert.equal((await store.load(500)).queue.length, 0, 'entri antrean hilang dari database setelah cocok');
});

test('restart: urutan antrean dipulihkan adil (yang paling lama menunggu dulu), bukan urutan acak database', async () => {
  const { store } = await freshStore();
  store.addQueue('terakhir', 300); store.addQueue('pertama', 100); store.addQueue('kedua', 200);
  await store.flush();
  const state = await store.load(500);
  assert.deepEqual(state.queue.map((q) => q.userId), ['pertama', 'kedua', 'terakhir']);
  const mm = new Matchmaker(() => 1_000_000);
  mm.restore(state);
  assert.equal(mm.join('x').partnerId, 'pertama');
});

test('restart: pemain yang keluar (/stop) atau sudah cocok tidak ikut dipulihkan', async () => {
  const { store } = await freshStore();
  let t = 5_000_000;
  const mm = new Matchmaker(() => t, store);
  mm.join('a'); mm.join('b');         // a menunggu, b cocok dengan a
  mm.join('c');                       // c menunggu
  t += 10_000; mm.leave('c');         // c /stop
  mm.join('d');                       // d menunggu
  await store.flush();
  const state = await store.load(500);
  assert.deepEqual(state.queue.map((q) => q.userId), ['d']);
});
