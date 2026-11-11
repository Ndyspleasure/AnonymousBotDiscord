'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PGlite } = require('@electric-sql/pglite');
const { PgStore } = require('../src/store');
const { Matchmaker } = require('../src/matchmaker');
const { Onboarding } = require('../src/onboarding');
const { checkMessage } = require('../src/filter');
const { firstUseNotice } = require('../src/notice');
const { IDS } = require('../src/relay');
const config = require('../config');

const quiet = { error() {} };
const flat = (x) => JSON.stringify(x);

test('pemain baru butuh sambutan; setelah ditandai tidak lagi', () => {
  const o = new Onboarding();
  const mm = new Matchmaker();
  assert.equal(o.needsFirstUse('u1', mm), true);
  assert.equal(o.mark('u1'), true);
  assert.equal(o.mark('u1'), false, 'idempoten');
  assert.equal(o.needsFirstUse('u1', mm), false);
  assert.equal(o.needsFirstUse('u2', mm), true, 'pemain lain tidak terpengaruh');
});

test('pemain yang sedang antre atau chat (mis. dipulihkan dari database) tidak diganggu', () => {
  const o = new Onboarding();
  const mm = new Matchmaker();
  mm.join('a');
  assert.equal(o.needsFirstUse('a', mm), false, 'antre');
  mm.join('b');
  assert.equal(o.needsFirstUse('b', mm), false, 'sedang chat');
});

test('penanda tersimpan di database dan dipulihkan setelah restart', async () => {
  const db = new PGlite();
  const store = new PgStore(db, quiet);
  await store.init();
  const o = new Onboarding(store);
  o.mark('u1', 1000); o.mark('u2', 2000); o.mark('u1', 3000);
  await store.flush();
  const n = Number((await db.query('SELECT COUNT(*)::int AS n FROM anon_seen')).rows[0].n);
  assert.equal(n, 2, 'tanpa duplikat');
  const state = await store.load(500);
  const o2 = new Onboarding(store);
  o2.restore(state.seen);
  assert.equal(o2.has('u1') && o2.has('u2'), true);
  assert.equal(o2.has('u3'), false);
});

test('tabel anon_seen ber-RLS (akses API data publik ditutup)', async () => {
  const { SCHEMA } = require('../src/store');
  assert.ok(SCHEMA.some((q) => /ALTER TABLE anon_seen ENABLE ROW LEVEL SECURITY/.test(q)));
});

test('kartu sambutan: panduan + peraturan + tombol anon:go, muat di batas V2', () => {
  const t = config.texts.firstUse;
  assert.ok(t.includes('Selamat datang di Vanillate Match'));
  assert.ok(t.includes('Peraturan Vanillate Match'));
  assert.ok(t.includes('/start') && t.includes('/terms'));
  assert.ok(t.length < 3900);
  const p = firstUseNotice();
  assert.ok(p.flags & (1 << 15));
  assert.ok(flat(p.components).includes(IDS.GO));
  assert.equal(IDS.GO, 'anon:go');
});

test('tidak ada nama lama "Anonymous Bot" di teks bot', () => {
  for (const [k, v] of Object.entries(config.texts)) {
    assert.ok(!String(v).includes('Anonymous Bot'), `texts.${k}`);
  }
  assert.equal(config.brand.name, 'Vanillate Match');
});

test('noChat untuk pemain lama: tidak menyesatkan, menunjuk /start dan /help', () => {
  assert.ok(config.texts.noChat.includes('/start') && config.texts.noChat.includes('/help'));
});

// Klaim di teks panduan harus sama dengan perilaku filter dan batas yang sebenarnya.
test('klaim panduan sesuai perilaku: batas angka diambil dari config.limits', () => {
  const w = config.texts.welcome;
  assert.ok(w.includes(`maks ${config.limits.maxMessageLength} karakter`));
  assert.ok(w.includes(`maks ${config.limits.maxMediaPerMessage} file`));
  assert.ok(w.includes(`${config.limits.maxMediaBytes / 1048576} MB`));
});

test('klaim "tidak bisa dikirim" benar-benar ditolak filter', () => {
  assert.equal(checkMessage('lihat https://contoh.com/x').ok, false, 'tautan biasa');
  assert.equal(checkMessage('gabung discord.gg/abcd').ok, false, 'undangan server');
  assert.equal(checkMessage('ini <:kustom:123456789012345678>').ok, false, 'emoji kustom');
  assert.equal(checkMessage('x'.repeat(config.limits.maxMessageLength + 1)).ok, false, 'terlalu panjang');
});

test('klaim "boleh dikirim" benar: teks, emoji standar, GIF Tenor/Giphy', () => {
  assert.equal(checkMessage('halo 😀 apa kabar').ok, true);
  assert.equal(checkMessage('https://tenor.com/view/x-1').ok, true);
  assert.equal(checkMessage('https://giphy.com/gifs/x').ok, true);
  assert.equal(checkMessage('x'.repeat(config.limits.maxMessageLength)).ok, true);
});

test('syarat dan ketentuan menyebut catatan penanda panduan (anon_seen) yang tidak dihapus', () => {
  const pasal = config.texts.terms.split('\n').find((l) => l.startsWith('**3.'));
  assert.ok(pasal.includes('pertama kali melihat panduan') && pasal.includes('tidak dihapus'));
});
