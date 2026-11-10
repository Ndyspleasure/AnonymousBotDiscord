'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkMessage } = require('../src/filter');

test('blok tautan, kosong, terlalu panjang', () => {
  assert.equal(checkMessage('lihat https://x.com').ok, false);
  assert.equal(checkMessage('discord.gg/abc').ok, false);
  assert.equal(checkMessage('   ').ok, false);
  assert.equal(checkMessage('a'.repeat(1001)).ok, false);
});

test('netralkan mention', () => {
  const r = checkMessage('hai @everyone <@123>');
  assert.ok(r.ok);
  assert.ok(!r.text.includes('@everyone'));
  assert.ok(!r.text.includes('<@'));
});

test('GIF Tenor/Giphy diizinkan, tautan lain dan undangan tetap diblokir', () => {
  assert.ok(checkMessage('https://tenor.com/view/abc-123').ok);
  assert.ok(checkMessage('lucu https://media.giphy.com/media/x/giphy.gif').ok);
  assert.equal(checkMessage('http://tenor.com/view/abc').ok, false);        // bukan https
  assert.equal(checkMessage('https://tenor.com.evil.com/x').ok, false);     // host palsu
  assert.equal(checkMessage('https://evil.com/x tenor.com').ok, false);
  assert.equal(checkMessage('https://discord.gg/abc').ok, false);
});

test('transkrip .txt memuat pengguna, alasan, pesan berlabel, dan penanda laporan', () => {
  const { buildTranscript } = require('../src/report');
  const info = {
    users: ['A', 'B'], startedAt: Date.UTC(2026, 0, 2, 3, 0, 0), endedAt: Date.UTC(2026, 0, 2, 3, 4, 5), reason: 'ended',
    history: [{ id: 1, from: 'A', text: 'halo', at: 0 },
      { id: 2, from: 'B', text: 'kasar', at: 1000, media: [{ name: 'media1.png', url: 'https://cdn/x.png' }] }],
  };
  const t = buildTranscript(info);
  assert.ok(t.startsWith('TRANSKRIP ANONYMOUS CHAT') && t.includes('USER A  : A') && t.includes('USER B  : B'));
  assert.ok(t.includes('USER A: halo') && t.includes('USER B: kasar') && t.includes('Chat diakhiri pengguna'));
  assert.ok(t.includes('media: media1.png https://cdn/x.png'));
  const r = buildTranscript({ ...info, reason: 'report', reporterId: 'A', flaggedId: 2 });
  assert.ok(r.startsWith('LAPORAN ANONYMOUS CHAT') && r.includes('USER A (PELAPOR): halo'));
  assert.ok(r.includes('>>> DILAPORKAN >>> ['));
});

test('emoji kustom ditolak dengan info emoji standar; emoji standar lolos', () => {
  const config = require('../config');
  const a = checkMessage('hai <a:EC_blobdance:853546342458458113>');
  assert.equal(a.ok, false); assert.equal(a.reason, config.texts.noCustomEmoji);
  assert.equal(checkMessage('<:wow:123456789>').ok, false);
  assert.ok(checkMessage('halo 😀🔥').ok);
});

test('tautan tak diizinkan memakai info baku; CDN Discord diizinkan', () => {
  const config = require('../config');
  assert.equal(checkMessage('https://evil.com/x').reason, config.texts.unsupported);
  assert.equal(checkMessage('https://discord.gg/abc').reason, config.texts.unsupported);
  assert.ok(checkMessage('https://media.discordapp.net/attachments/1/2/x.gif').ok);
  assert.ok(checkMessage('https://cdn.discordapp.com/attachments/1/2/x.gif').ok);
});
