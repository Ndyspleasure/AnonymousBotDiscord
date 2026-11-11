'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PGlite } = require('@electric-sql/pglite');
const { PgStore } = require('../src/store');
const { Matchmaker } = require('../src/matchmaker');
const config = require('../config');

const quiet = { error() {} };
async function freshStore() {
  const db = new PGlite();
  const store = new PgStore(db, quiet);
  await store.init();
  return { db, store };
}
const count = async (db, t) => Number((await db.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n);

test('chat, riwayat, dan antrean tersimpan lalu dipulihkan ke Matchmaker baru', async () => {
  const { store } = await freshStore();
  let t = 1_000_000;
  const mm = new Matchmaker(() => t, store);
  mm.join('a'); mm.join('b');                       // a antre, b dipasangkan dengan a
  t += 1000; const e1 = mm.record('a', 'halo', [{ name: 'media1.png', url: 'https://cdn/x.png' }]);
  t += 1000; const e2 = mm.record('b', 'hai');
  t += 6000; mm.join('c');                          // c antre sendirian
  await store.flush();

  // "restart": Matchmaker baru memuat dari database
  const state = await store.load(config.limits.transcriptMaxEntries);
  const mm2 = new Matchmaker(() => t, store);
  const r = mm2.restore(state);
  assert.deepEqual(r.users.sort(), ['a', 'b']);
  assert.deepEqual(r.queued, ['c']);
  assert.equal(mm2.partnerOf('a'), 'b');
  assert.ok(mm2.isQueued('c'));
  const hist = mm2.sessions.get('a').chat.history;
  assert.deepEqual(hist.map((h) => h.text), ['halo', 'hai']);
  assert.deepEqual(hist[0].media, [{ name: 'media1.png', url: 'https://cdn/x.png' }]);
  // id pesan berlanjut, tidak bentrok dengan tombol Report lama
  const e3 = mm2.record('a', 'lanjut');
  assert.ok(e3.id > e2.id && e2.id > e1.id);
  // tombol Report lama tetap valid
  assert.equal(mm2.findEntry('b', e1.id).text, 'halo');
});

test('chat berakhir: transkrip dikirim lalu baris dihapus dari database', async () => {
  const { db, store } = await freshStore();
  let t = 1_000_000;
  const mm = new Matchmaker(() => t, store);
  const ended = []; mm.onEnd = (info) => { ended.push(info); return true; };
  mm.join('a'); mm.join('b'); mm.record('a', 'halo');
  await store.flush();
  assert.equal(await count(db, 'anon_chats'), 1);
  assert.equal(await count(db, 'anon_history'), 1);
  mm.leave('a');
  await mm.lastEnd; await store.flush();
  assert.equal(ended.length, 1);
  assert.equal(await count(db, 'anon_chats'), 0);
  assert.equal(await count(db, 'anon_history'), 0, 'riwayat ikut terhapus (cascade)');
  assert.equal(await count(db, 'anon_queue'), 0);
});

test('keluar antrean dan kedaluwarsa menghapus baris antrean', async () => {
  const asliAntre = config.limits.queueTimeoutMs; config.limits.queueTimeoutMs = 5 * 60_000; // kedaluwarsa antrean hanya bila dinyalakan
  try { await keluarAntrean(); } finally { config.limits.queueTimeoutMs = asliAntre; }
});
async function keluarAntrean() {
  const { db, store } = await freshStore();
  let t = 1_000_000;
  const mm = new Matchmaker(() => t, store);
  mm.join('a'); mm.join('x'); // a antre lalu x dipasangkan: antrean kosong
  mm.leave('a');
  t += 10_000; mm.join('q'); await store.flush();
  assert.equal(await count(db, 'anon_queue'), 1);
  t += config.limits.queueTimeoutMs + 1; mm.sweep(); await store.flush();
  assert.equal(await count(db, 'anon_queue'), 0);
}

test('kegagalan database tidak menjatuhkan Matchmaker', async () => {
  const bad = { query: async () => { throw new Error('db mati'); } };
  const store = new PgStore(bad, quiet);
  const mm = new Matchmaker(() => 1_000_000, store);
  mm.join('a'); mm.join('b');
  assert.equal(mm.partnerOf('a'), 'b');
  assert.ok(mm.record('a', 'halo'));
  await store.flush(); // tidak melempar
});
