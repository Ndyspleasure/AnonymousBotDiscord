'use strict';
const test = require('node:test');
const assert = require('node:assert');
const config = require('../config');
const { msg, messages } = require('../src/messages');
const { buildRelay } = require('../src/relay');
const { notice } = require('../src/notice');
const { checkMessage } = require('../src/filter');

const flat = (x) => JSON.stringify(x);

test('pesan "terhubung": jelas bahwa chat SUDAH dimulai dan tinggal kirim pesan biasa', () => {
  const t = msg('connected');
  assert.ok(t.includes('Terhubung'));
  assert.ok(t.includes('sudah dimulai'), 'menyatakan chat sudah berjalan');
  assert.ok(t.includes('Kirim saja pesan biasa'), 'langkah utama: kirim pesan biasa');
  assert.ok(!t.startsWith('✅ **Terhubung!** Kirim pesan biasa di DM ini. `/next`'), 'bukan lagi daftar command mentah');
  // command hanya disebut sebagai pilihan, setelah langkah utama
  assert.ok(t.indexOf('Kirim saja pesan biasa') < t.indexOf('/next'));
});

test('pesan "terhubung" cocok dengan kartu relay yang benar-benar dilihat lawan bicara', () => {
  const relay = flat(buildRelay({ text: 'halo', entryId: 1 }));
  assert.ok(relay.includes('Stranger'), 'relay memakai label Stranger');
  assert.ok(msg('connected').includes('**Stranger**'));
  for (const tombol of ['Next', 'Stop', 'Report']) {
    assert.ok(relay.includes(tombol), `relay punya tombol ${tombol}`);
    assert.ok(msg('connected').includes(tombol), `pesan terhubung menyebut tombol ${tombol}`);
  }
});

test('angka di pesan mengikuti config.limits (tidak bisa basi)', () => {
  const L = config.limits;
  assert.ok(msg('connected').includes(`${Math.round(L.idleTimeoutMs / 60000)} menit`));
  assert.ok(msg('queued').includes(`${Math.round(L.queueTimeoutMs / 60000)} menit`));
  assert.ok(msg('cooldown').includes(`${Math.ceil(L.startCooldownMs / 1000)} detik`));
  assert.ok(msg('tooFast').includes(`${L.msgPerWindow} pesan per ${Math.ceil(L.msgWindowMs / 1000)} detik`));
  assert.ok(msg('tooManyFiles').includes(`${L.maxMediaPerMessage} file`));
  assert.ok(msg('fileTooBig').includes(`${Math.floor(L.maxMediaBytes / 1048576)} MB`));
  assert.ok(msg('tooLong').includes(`${L.maxMessageLength} karakter`));
  assert.ok(msg('idleEnded').includes(`${Math.round(L.idleTimeoutMs / 60000)} menit`));
});

test('antrean: menjelaskan tidak perlu bertindak dan cara batal', () => {
  const t = msg('queued');
  assert.ok(t.includes('tidak perlu melakukan apa pun'));
  assert.ok(t.includes('/stop'));
});

test('sedang chat vs sedang antre punya pesan berbeda saat /start lagi', () => {
  assert.notStrictEqual(msg('busyInChat'), msg('busyInQueue'));
  assert.ok(msg('busyInChat').includes('masih terhubung') && msg('busyInChat').includes('/next'));
  assert.ok(msg('busyInQueue').includes('antrean') && msg('busyInQueue').includes('/stop'));
});

test('/stop membedakan keluar dari chat dan keluar dari antrean', () => {
  assert.ok(msg('stoppedChat').includes('Chat diakhiri'));
  assert.ok(msg('stoppedQueue').includes('keluar dari antrean'));
  assert.ok(msg('stopNothing').includes('tidak sedang dalam chat atau antrean'));
});

test('pesan ke lawan bicara tidak membocorkan siapa yang melapor', () => {
  assert.ok(!/lapor|report/i.test(msg('chatEnded')));
  assert.ok(msg('partnerLeft').includes('/start') && msg('chatEnded').includes('/start'));
});

test('laporan: terkirim vs belum terkirim dibedakan dengan jujur', () => {
  assert.ok(msg('reportSent').includes('terkirim ke moderator'));
  assert.ok(msg('reportNotSent').includes('belum bisa dikirim'));
  assert.ok(msg('reportNotSent').includes('Chat diakhiri'));
});

test('semua peringatan penolakan menyatakan pesan TIDAK diteruskan', () => {
  for (const k of ['empty', 'tooFast', 'tooManyFiles', 'fileTooBig', 'unsupported', 'customEmoji', 'tooLong', 'blockedWord']) {
    assert.ok(/tidak diteruskan/.test(msg(k)), k);
  }
  // dan dipakai apa adanya oleh filter
  assert.equal(checkMessage('x'.repeat(config.limits.maxMessageLength + 1)).reason, msg('tooLong'));
  assert.equal(checkMessage('https://contoh.com/x').reason, config.texts.unsupported);
  assert.equal(checkMessage('<:a:123456789012345678>').reason, config.texts.noCustomEmoji);
});

test('semua pesan: memuat petunjuk berikutnya, muat di batas V2, tanpa nama lama, tanpa tanda pisah terlarang', () => {
  for (const k of Object.keys(messages)) {
    const t = msg(k);
    assert.ok(typeof t === 'string' && t.length > 0, k);
    assert.ok(t.length < 3900, `${k} muat di kartu V2`);
    assert.ok(!t.includes('Anonymous Bot'), `${k} tanpa nama lama`);
    assert.ok(!/ — | – | - /.test(t), `${k} tanpa tanda pisah terlarang`);
    const p = notice(t);
    assert.ok(p.flags & (1 << 15), `${k} kartu V2`);
  }
  assert.throws(() => msg('tidak_ada'), /tidak dikenal/);
});

test('pesan akhir chat/antrean selalu menunjuk cara mulai lagi (/start)', () => {
  for (const k of ['stoppedChat', 'stoppedQueue', 'stopNothing', 'partnerLeft', 'chatEnded', 'queueExpired', 'idleEnded', 'relayUnreachable', 'matchUnreachable', 'reportSent', 'reportNotSent']) {
    assert.ok(msg(k).includes('/start'), `${k} menyebut /start`);
  }
});
