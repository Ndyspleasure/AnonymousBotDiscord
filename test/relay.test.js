'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { IDS, buildRelay } = require('../src/relay');
const config = require('../config');

const flat = (o) => JSON.stringify(o);

test('relay teks: Components V2, tombol Next/Stop/Report, footer', () => {
  const p = buildRelay({ text: 'halo', entryId: 7 });
  assert.ok(p.flags & (1 << 15), 'flag IsComponentsV2');
  assert.equal(p.content, undefined, 'V2 tidak boleh memakai content');
  const j = flat(p.components);
  assert.ok(j.includes(IDS.NEXT) && j.includes(IDS.STOP) && j.includes(`${IDS.REPORT}7`));
  assert.ok(j.includes(config.texts.footer) && j.includes('halo'));
  assert.deepEqual(p.allowedMentions, { parse: [] });
});

test('relay media: galeri attachment:// dan tombol "Laporkan pesan ini"', () => {
  const p = buildRelay({ text: null, entryId: 9, files: [{ attachment: 'https://cdn/x.png', name: 'media1.png' }] });
  const j = flat(p.components);
  assert.ok(j.includes('attachment://media1.png') && j.includes('Laporkan pesan ini'));
  assert.equal(p.files.length, 1);
});

test('relay GIF (tautan) memakai pesan klasik agar tautan tampil', () => {
  const p = buildRelay({ text: 'https://tenor.com/view/x-1', entryId: 3 });
  assert.equal(p.flags, undefined);
  assert.ok(p.content.includes('https://tenor.com/view/x-1') && p.content.includes(config.texts.footer));
  assert.ok(flat(p.components).includes(`${IDS.REPORT}3`));
});

test('relay GIF terselesaikan: galeri V2 dengan URL langsung, tanpa pesan klasik', () => {
  const p = buildRelay({ text: null, entryId: 4, mediaUrls: ['https://media.tenor.com/x.mp4'] });
  assert.ok(p.flags & (1 << 15));
  assert.ok(flat(p.components).includes('https://media.tenor.com/x.mp4'));
});

test('relay classic:true memaksa pesan klasik walau ada URL media', () => {
  const p = buildRelay({ text: 'https://tenor.com/view/x-1', entryId: 5, classic: true, mediaUrls: ['u'] });
  assert.equal(p.flags, undefined);
  assert.ok(p.content.includes('https://tenor.com/view/x-1'));
});

test('notice: kartu V2 tanpa embed/content, ephemeral menambah flag', () => {
  const { notice, ephemeral } = require('../src/notice');
  const n = notice('⚠️ Halo');
  assert.ok(n.flags & (1 << 15));
  assert.equal(n.embeds, undefined); assert.equal(n.content, undefined);
  assert.ok(flat(n.components).includes('⚠️ Halo'));
  const e = ephemeral(n);
  assert.ok(e.flags & (1 << 15) && e.flags & 64, 'V2 + ephemeral');
});

test('teks panduan/peraturan/syarat muat di batas V2', () => {
  for (const k of ['welcome', 'rules', 'terms']) assert.ok(config.texts[k].length < 3900, k);
});

test('installNotice: kartu V2 dengan tombol link User Install', () => {
  const { installNotice, installUrl } = require('../src/notice');
  const p = installNotice('123');
  assert.ok(p.flags & (1 << 15));
  const j = flat(p.components);
  assert.ok(j.includes(installUrl('123')) && j.includes('integration_type=1') && j.includes('scope=applications.commands'));
  assert.ok(j.includes('hanya berfungsi lewat DM'));
});

test('command hanya User Install', () => {
  const { definitions } = require('../src/commands');
  assert.ok(definitions.every((d) => JSON.stringify(d.integration_types) === '[1]'));
});
