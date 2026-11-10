'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { firstUrl, isDirectMedia, pickEmbedMedia, resolveGif } = require('../src/gif');

test('isDirectMedia: berkas langsung vs halaman', () => {
  assert.ok(isDirectMedia('https://media.discordapp.net/attachments/1/2/x.gif?ex=1'));
  assert.ok(isDirectMedia('https://media.tenor.com/abc/x'));
  assert.equal(isDirectMedia('https://tenor.com/view/x-123'), false);
  assert.equal(isDirectMedia('bukan url'), false);
});

test('pickEmbedMedia mengutamakan video lalu gambar', () => {
  assert.equal(pickEmbedMedia([{ video: { url: 'v' }, thumbnail: { url: 't' } }]), 'v');
  assert.equal(pickEmbedMedia([{ thumbnail: { url: 't' } }]), 't');
  assert.equal(pickEmbedMedia([]), null);
});

test('resolveGif: tautan langsung langsung jadi media, sisa teks dipertahankan', async () => {
  const r = await resolveGif({}, 'lucu https://media.tenor.com/a/b.gif');
  assert.deepEqual(r, { url: 'https://media.tenor.com/a/b.gif', rest: 'lucu' });
  assert.equal(firstUrl('tanpa tautan'), null);
});

test('resolveGif: tautan halaman menunggu embed, null bila tak muncul', async () => {
  let calls = 0;
  const msg = { embeds: [], fetch: async () => { calls++; return calls >= 2 ? { embeds: [{ video: { url: 'https://media.tenor.com/x.mp4' } }], fetch: msg.fetch } : msg; } };
  const ok = await resolveGif(msg, 'https://tenor.com/view/x-1', { tries: 3, delay: 1 });
  assert.equal(ok.url, 'https://media.tenor.com/x.mp4'); assert.equal(ok.rest, '');
  const none = { embeds: [], fetch: async () => none };
  assert.equal(await resolveGif(none, 'https://tenor.com/view/x-1', { tries: 2, delay: 1 }), null);
});
