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
