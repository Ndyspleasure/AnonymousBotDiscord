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

test('laporan .txt memuat pelapor, terlapor, dan pesan berlabel', () => {
  const { buildReportText } = require('../src/report');
  const t = buildReportText({
    reporterId: 'A', reportedId: 'B', now: Date.UTC(2026, 0, 2, 3, 4, 5),
    flaggedId: 2,
    buffer: [{ id: 1, from: 'A', text: 'halo', at: 0 },
      { id: 2, from: 'B', text: 'kasar', at: 1000, media: [{ name: 'media1.png', url: 'https://cdn/x.png' }] }],
  });
  assert.ok(t.includes('>>> DILAPORKAN >>> [') && t.includes('media: media1.png https://cdn/x.png'));
  assert.ok(t.includes('Pelapor       : A') && t.includes('Terlapor      : B'));
  assert.ok(t.includes('PELAPOR : halo') && t.includes('TERLAPOR: kasar'));
  assert.ok(t.includes('2026-01-02 03:04:05 UTC'));
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
