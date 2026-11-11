'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Matchmaker } = require('../src/matchmaker');
const config = require('../config');

test('dua user dipasangkan, lalu bisa leave', () => {
  let t = 1_000_000; const mm = new Matchmaker(() => t);
  assert.equal(mm.join('a').status, 'queued');
  const r = mm.join('b');
  assert.equal(r.status, 'matched'); assert.equal(r.partnerId, 'a');
  assert.equal(mm.partnerOf('a'), 'b');
  assert.equal(mm.leave('a'), 'b');
  assert.equal(mm.partnerOf('b'), null);
});

test('cooldown & busy', () => {
  let t = 1_000_000; const mm = new Matchmaker(() => t);
  mm.join('a'); assert.equal(mm.join('a').status, 'busy');
  mm.leave('a'); assert.equal(mm.join('a').status, 'cooldown');
  t += config.limits.startCooldownMs + 1; assert.equal(mm.join('a').status, 'queued');
});

test('rate limit pesan', () => {
  let t = 1_000_000; const mm = new Matchmaker(() => t);
  for (let i = 0; i < config.limits.msgPerWindow; i++) assert.ok(mm.allowMessage('a'));
  assert.equal(mm.allowMessage('a'), false);
  t += config.limits.msgWindowMs + 1; assert.ok(mm.allowMessage('a'));
});

test('sweep antrean & sesi idle, buffer laporan terbatas', () => {
  let t = 1_000_000; const mm = new Matchmaker(() => t);
  mm.join('a'); t += config.limits.queueTimeoutMs + 1;
  assert.deepEqual(mm.sweep().queueExpired, ['a']);
  t += 10_000; mm.join('a'); mm.join('b');
  for (let i = 0; i < config.limits.transcriptMaxEntries + 5; i++) mm.record('a', 'x' + i);
  assert.equal(mm.sessions.get('b').chat.history.length, config.limits.transcriptMaxEntries);
  t += config.limits.idleTimeoutMs + 1;
  assert.equal(mm.sweep().sessionsExpired.length, 1);
  assert.equal(mm.partnerOf('a'), null);
});

test('record memberi id unik; findEntry hanya di chat aktif', () => {
  let t = 1_000_000; const mm = new Matchmaker(() => t);
  mm.join('a'); mm.join('b');
  const e1 = mm.record('a', 'halo', [{ name: 'media1.png', url: 'u' }]);
  const e2 = mm.record('b', 'hai');
  assert.notEqual(e1.id, e2.id);
  assert.equal(mm.findEntry('b', e1.id).from, 'a');
  assert.equal(mm.findEntry('a', e2.id).text, 'hai');
  mm.leave('a');
  assert.equal(mm.findEntry('b', e1.id), null, 'hilang saat chat berakhir');
});

test('onEnd dipanggil sekali dengan riwayat saat chat berakhir (stop, report, sepi)', async () => {
  let t = 1_000_000; const mm = new Matchmaker(() => t);
  const ended = []; mm.onEnd = (info) => { ended.push(info); return true; };
  mm.join('a'); mm.join('b'); mm.record('a', 'halo'); mm.record('b', 'hai');
  mm.leave('a');
  assert.equal(ended.length, 1);
  assert.deepEqual([...ended[0].users].sort(), ['a', 'b']); assert.equal(ended[0].history.length, 2); assert.equal(ended[0].reason, 'ended');
  assert.equal(mm.leave('b'), null, 'tidak dipanggil dua kali');
  assert.equal(ended.length, 1);
  // report membawa meta
  t += 10_000; mm.join('a'); mm.join('b'); mm.record('b', 'kasar');
  const e = mm.record('b', 'lagi');
  mm.lastEnd = null; mm.leave('a', { reporterId: 'a', flaggedId: e.id });
  assert.equal(await mm.lastEnd, true);
  assert.equal(ended[1].reason, 'report'); assert.equal(ended[1].reporterId, 'a'); assert.equal(ended[1].flaggedId, e.id);
  // sepi
  t += 10_000; mm.join('a'); mm.join('b'); mm.record('a', 'x');
  t += config.limits.idleTimeoutMs + 1; mm.sweep();
  assert.equal(ended[2].reason, 'idle');
  // chat tanpa pesan tidak menghasilkan transkrip
  t += 10_000; mm.join('a'); mm.join('b'); mm.leave('a');
  assert.equal(ended.length, 3);
});

test('endAll mengakhiri semua chat dan antrean, mengirim transkrip, mengembalikan pengguna', async () => {
  let t = 1_000_000; const mm = new Matchmaker(() => t);
  const ended = []; mm.onEnd = (info) => { ended.push(info); return true; };
  mm.join('a'); mm.join('b'); mm.record('a', 'halo');
  t += 10_000; mm.join('c'); mm.join('d');           // chat kedua tanpa pesan
  t += 10_000; mm.join('e');                           // antre sendirian
  const r = mm.endAll('restart');
  assert.deepEqual(r.users.sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(r.queued, ['e']);
  assert.equal(ended.length, 1, 'hanya chat berpesan yang dikirim transkripnya');
  assert.equal(ended[0].reason, 'restart');
  assert.equal(r.ends.length, 1);
  assert.equal(mm.sessions.size, 0); assert.equal(mm.queue.size, 0);
});

// ─── Pengingat sepi ─────────────────────────────────────────────────────────
const H = 3600_000;
function chatBerdua(t0 = 1_000_000) {
  const clock = { t: t0 };
  const mm = new Matchmaker(() => clock.t);
  mm.join('a'); mm.join('b');
  return { mm, clock };
}

test('pengingat sepi: tiap 6 jam, 3 kali, lalu chat berakhir di 24 jam', () => {
  const { mm, clock } = chatBerdua();
  const t0 = clock.t;
  clock.t = t0 + 5 * H;  assert.deepEqual(mm.sweep().remind, [], 'belum 6 jam');
  clock.t = t0 + 6 * H;  let r = mm.sweep(); assert.equal(r.remind.length, 1); assert.equal(r.remind[0].count, 1); assert.deepEqual([...r.remind[0].users].sort(), ['a', 'b']);
  clock.t = t0 + 7 * H;  assert.deepEqual(mm.sweep().remind, [], 'tidak diulang sebelum jatah berikutnya');
  clock.t = t0 + 12 * H; r = mm.sweep(); assert.equal(r.remind[0].count, 2);
  clock.t = t0 + 18 * H; r = mm.sweep(); assert.equal(r.remind[0].count, 3);
  clock.t = t0 + 23 * H; assert.deepEqual(mm.sweep().remind, []);
  clock.t = t0 + 24 * H + 1; r = mm.sweep();
  assert.equal(r.remind.length, 0, 'saat berakhir tidak ada pengingat lagi');
  assert.equal(r.sessionsExpired.length, 1);
  assert.equal(mm.partnerOf('a'), null);
});

test('pengingat sepi: pesan baru mengulang hitungan dari awal', () => {
  const { mm, clock } = chatBerdua();
  const t0 = clock.t;
  clock.t = t0 + 6 * H; assert.equal(mm.sweep().remind.length, 1);
  clock.t = t0 + 8 * H; mm.record('a', 'masih di sini');
  clock.t = t0 + 13 * H; assert.deepEqual(mm.sweep().remind, [], '5 jam sejak pesan terakhir');
  clock.t = t0 + 14 * H; const r = mm.sweep();
  assert.equal(r.remind.length, 1); assert.equal(r.remind[0].count, 1, 'dihitung ulang dari pengingat pertama');
});

test('pengingat sepi: sweep telat tidak mengirim dobel atau melompat berulang', () => {
  const { mm, clock } = chatBerdua();
  const t0 = clock.t;
  clock.t = t0 + 13 * H; // bot mati lama: sudah lewat dua jatah
  let r = mm.sweep(); assert.equal(r.remind.length, 1); assert.equal(r.remind[0].count, 2, 'satu pesan dengan hitungan terbaru');
  r = mm.sweep(); assert.deepEqual(r.remind, [], 'pemanggilan berikutnya tidak mengulang');
});

test('pengingat sepi: chat yang dipulihkan dari database tidak langsung dapat pengingat dobel', () => {
  const t = 5_000_000;
  const mm = new Matchmaker(() => t);
  mm.restore({ chats: [{ id: 'c1', users: ['a', 'b'], startedAt: t - 30 * H, lastActivity: t - 7 * H, history: [] }] });
  assert.deepEqual(mm.sweep().remind, [], 'pengingat ke-1 sudah lewat sebelum restart');
  const lain = new Matchmaker(() => t);
  lain.restore({ chats: [{ id: 'c2', users: ['x', 'y'], startedAt: t - 30 * H, lastActivity: t - 2 * H, history: [] }] });
  assert.deepEqual(lain.sweep().remind, []);
});

test('pengingat sepi dimatikan atau tak masuk akal: tidak pernah mengingatkan', () => {
  const asli = config.limits.idleReminderMs;
  try {
    for (const v of [0, -1, config.limits.idleTimeoutMs, config.limits.idleTimeoutMs * 2, undefined]) {
      config.limits.idleReminderMs = v;
      const { mm, clock } = chatBerdua();
      clock.t += 23 * H;
      assert.deepEqual(mm.sweep().remind, [], String(v));
    }
  } finally { config.limits.idleReminderMs = asli; }
});

test('pengingat sepi: antrean dan chat lain tidak terpengaruh', () => {
  const { mm, clock } = chatBerdua();
  mm.join('c'); // antre sendirian
  clock.t += 6 * H;
  const r = mm.sweep();
  assert.deepEqual(r.queueExpired, ['c'], 'antrean tetap habis 5 menit');
  assert.equal(r.remind.length, 1);
});
