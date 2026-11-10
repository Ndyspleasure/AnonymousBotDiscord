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
  for (let i = 0; i < 25; i++) mm.record('a', 'x' + i);
  assert.equal(mm.snapshot('b').length, config.limits.reportBufferSize);
  t += config.limits.idleTimeoutMs + 1;
  assert.equal(mm.sweep().sessionsExpired.length, 1);
  assert.equal(mm.partnerOf('a'), null);
});
