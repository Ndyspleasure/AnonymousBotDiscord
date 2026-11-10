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
