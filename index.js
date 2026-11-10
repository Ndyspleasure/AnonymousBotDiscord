'use strict';
require('dotenv').config();
const crypto = require('node:crypto');
const {
  Client, GatewayIntentBits, Partials, MessageFlags, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StickerFormatType,
} = require('discord.js');
const config = require('./config');
const { Matchmaker } = require('./src/matchmaker');
const { checkMessage } = require('./src/filter');
const { syncCommands } = require('./src/registerCommands');
const { sendReportFile } = require('./src/report');

const mm = new Matchmaker();
const COMMANDS = new Set(require('./src/commands').definitions.map((d) => d.name));
const greeted = new Set(); // user yang sudah dapat panduan (memori saja)

const client = new Client({
  // DM tidak butuh intent privileged (MessageContent) untuk membaca isi pesan.
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel, Partials.Message],
});

const say = (text) => new EmbedBuilder().setColor(config.brand.color).setDescription(text);

async function dm(userId, payload) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(payload);
    return true;
  } catch { return false; }
}

async function endBoth(userId, partnerId, reasonToPartner) {
  if (partnerId && reasonToPartner) await dm(partnerId, { embeds: [say(reasonToPartner)] });
}

async function handleCommand(i) {
  const id = i.user.id;
  const sub = i.commandName;
  const reply = (text) => i.reply({ embeds: [say(text)], flags: MessageFlags.Ephemeral });

  if (mm.isBanned(id)) return reply('⛔ Kamu tidak dapat menggunakan bot ini.');

  if (sub === 'help') return reply(config.texts.welcome);
  if (sub === 'rules') return reply(config.texts.rules);
  if (sub === 'terms') return reply(config.texts.terms);

  if (sub === 'dewasa') {
    const on = i.options.getBoolean('aktif', true);
    mm.setAdult(id, on);
    return reply(on
      ? '🔞 Mode 18+ **aktif** untuk chat ini. Dengan mengaktifkannya kamu menyatakan berusia **18 tahun ke atas**. Gambar & video baru terkirim bila lawan bicaramu juga mengaktifkannya. Mati otomatis saat chat berakhir.'
      : '✅ Mode 18+ dimatikan. Gambar & video tidak akan dikirim atau diterima.');
  }

  if (sub === 'start' || sub === 'next') {
    if (sub === 'next') {
      const p = mm.leave(id);
      await endBoth(id, p, '👋 Lawan bicaramu mengakhiri chat. Ketik `/start` untuk cari lagi.');
      mm.cooldowns.delete(id);
    }
    const r = mm.join(id);
    if (r.status === 'cooldown') return reply('⏳ Tunggu sebentar sebelum mencari lagi.');
    if (r.status === 'busy') return reply('Kamu sedang dalam chat/antrean. Pakai `/stop` untuk berhenti.');
    if (r.status === 'queued') {
      // pastikan bot bisa DM user ini
      const ok = await dm(id, { embeds: [say('🔎 Mencari lawan bicara… Kamu akan diberi tahu di DM ini saat cocok.')] });
      if (!ok) { mm.leave(id); return reply('❌ Bot tidak bisa mengirim DM. Buka profil bot → **Kirim Pesan**, lalu coba lagi.'); }
      greeted.add(id);
      return reply('🔎 Masuk antrean. Cek DM dari bot ini.');
    }
    // matched
    const matchMsg = '✅ **Terhubung!** Kirim pesan biasa di DM ini. `/next` · `/stop` · `/report`';
    const okPartner = await dm(r.partnerId, { embeds: [say(matchMsg)] });
    if (!okPartner) { mm.leave(id); return reply('Lawan bicara tidak dapat dihubungi. Coba `/start` lagi.'); }
    await dm(id, { embeds: [say(matchMsg)] });
    greeted.add(id);
    return reply('✅ Terhubung! Lanjutkan di DM bot ini.');
  }

  if (sub === 'stop') {
    const wasQueued = mm.isQueued(id);
    const p = mm.leave(id);
    if (!p && !wasQueued) return reply('Kamu tidak sedang dalam chat.');
    await endBoth(id, p, '👋 Lawan bicaramu mengakhiri chat.');
    return reply('🛑 Selesai. Ketik `/start` kapan saja.');
  }

  if (sub === 'report') {
    const p = mm.partnerOf(id);
    if (!p) return reply('Tidak ada chat aktif untuk dilaporkan.');
    const ok = await sendReportFile(process.env.REPORT_WEBHOOK_URL, { reporterId: id, reportedId: p, buffer: mm.snapshot(id) });
    mm.leave(id);
    await endBoth(id, p, '👋 Chat diakhiri.');
    return reply(ok ? '🚩 Laporan terkirim ke moderator & chat diakhiri. Terima kasih.'
                    : '🚩 Chat diakhiri. (Kanal laporan belum dikonfigurasi oleh pemilik bot.)');
  }
}

async function handleDM(msg) {
  const id = msg.author.id;
  if (mm.isBanned(id)) return;
  const partner = mm.partnerOf(id);
  if (!partner) {
    if (!greeted.has(id)) { greeted.add(id); await msg.channel.send({ embeds: [say(config.texts.welcome)] }).catch(() => {}); }
    else if (!mm.isQueued(id)) await msg.channel.send({ embeds: [say('Belum ada chat aktif. Ketik `/start`.')] }).catch(() => {});
    return;
  }
  const warn = (t) => msg.reply(`⚠️ ${t}`).catch(() => {});
  const hasText = Boolean(msg.content?.trim());
  const hasMedia = msg.attachments.size > 0;
  const hasSticker = Boolean(msg.stickers?.size);
  if (!hasText && !hasMedia && !hasSticker) return warn('Pesan kosong.');
  if (!mm.allowMessage(id)) return warn('⏳ Terlalu cepat, pelan-pelan ya.');

  let text = null;
  if (hasText) {
    const c = checkMessage(msg.content);
    if (!c.ok) return warn(c.reason);
    text = c.text;
  }

  // Gambar & video: hanya bila kedua pihak mengaktifkan mode 18+.
  let mediaFiles = [];
  if (hasMedia) {
    const list = [...msg.attachments.values()];
    if (list.length > config.limits.maxMediaPerMessage) return warn(`Maksimal ${config.limits.maxMediaPerMessage} file per pesan.`);
    const bad = list.find((a) => !/^(image|video)\//.test(a.contentType || '') || a.size > config.limits.maxMediaBytes);
    if (bad) return warn(`Hanya gambar/video maks ${Math.floor(config.limits.maxMediaBytes / 1048576)} MB yang diizinkan.`);
    if (!mm.isAdult(id)) return warn('Gambar & video butuh mode 18+. Ketik `/dewasa aktif:True` (khusus usia 18+).');
    if (!mm.isAdult(partner)) return warn('Lawan bicaramu belum mengaktifkan mode 18+, jadi media tidak dikirim.');
    mediaFiles = list.map((a) => ({ attachment: a.url, name: `SPOILER_${a.name || 'media'}` }));
  }

  // Stiker: dikirim sebagai gambar (Lottie tidak didukung).
  const stickerFiles = [];
  if (hasSticker) {
    for (const st of msg.stickers.values()) {
      if (st.format === StickerFormatType.Lottie) return warn('Stiker animasi jenis ini belum didukung.');
      const ext = st.format === StickerFormatType.GIF ? 'gif' : 'png';
      stickerFiles.push({ attachment: st.url, name: `${st.name || 'stiker'}.${ext}` });
    }
  }

  if (text || stickerFiles.length) {
    const sent = await dm(partner, {
      content: text ? `💬 **Stranger:** ${text}` : '💬 **Stranger:** (stiker)',
      files: stickerFiles,
      allowedMentions: { parse: [] },
    });
    if (!sent) { mm.leave(id); return warn('❌ Lawan bicara tidak dapat dihubungi. Chat diakhiri.'); }
  }

  if (mediaFiles.length) {
    const token = crypto.randomBytes(8).toString('hex');
    mm.addPending(token, id, partner, mediaFiles);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`anonmedia:${token}`).setLabel('Tampilkan').setEmoji('🔞').setStyle(ButtonStyle.Danger),
    );
    const sent = await dm(partner, {
      embeds: [say(`🔞 Lawan bicaramu mengirim **${mediaFiles.length} media** (gambar/video) yang bisa berisi konten dewasa. Tekan **Tampilkan** hanya jika kamu berusia 18+ dan mau melihatnya. Jika tidak nyaman, abaikan lalu pakai \`/next\` atau \`/report\`.`)],
      components: [row],
    });
    if (!sent) { mm.leave(id); return warn('❌ Lawan bicara tidak dapat dihubungi. Chat diakhiri.'); }
  }

  mm.record(id, [text, hasSticker && '[stiker]', hasMedia && '[media tidak ikut dilaporkan]'].filter(Boolean).join(' '));
  msg.react('✅').catch(() => {});
}

async function handleMediaButton(i) {
  const token = i.customId.slice('anonmedia:'.length);
  const m = mm.takePending(token, i.user.id);
  if (!m) return i.reply({ content: '⌛ Media sudah kedaluwarsa atau chat telah berakhir.', flags: MessageFlags.Ephemeral });
  if (!mm.isAdult(i.user.id)) {
    mm.pendingMedia.set(token, m); // kembalikan, belum diaktifkan
    return i.reply({ content: '🔞 Aktifkan dulu mode 18+ dengan `/dewasa aktif:True`, lalu tekan Tampilkan lagi.', flags: MessageFlags.Ephemeral });
  }
  await i.update({ components: [] }).catch(() => {});
  await i.followUp({ content: '🔞 **Media dari Stranger**', files: m.files }).catch(async () => {
    await i.followUp({ content: '❌ Media tidak bisa ditampilkan (mungkin sudah dihapus pengirim).', flags: MessageFlags.Ephemeral }).catch(() => {});
  });
}

client.on('interactionCreate', (i) => {
  if (i.isButton() && i.customId.startsWith('anonmedia:')) {
    handleMediaButton(i).catch((e) => console.error('[media]', e));
    return;
  }
  if (i.isChatInputCommand() && COMMANDS.has(i.commandName)) {
    handleCommand(i).catch((e) => console.error(`[${i.commandName}]`, e));
  }
});

client.on('messageCreate', (m) => {
  if (m.author.bot || !m.channel.isDMBased()) return;
  handleDM(m).catch((e) => console.error('[dm]', e));
});

client.once('clientReady', () => {
  console.log(`✅ ${client.user.tag} online`);
  // Pendaftaran command otomatis (tanpa perlu `node deploy-commands.js` manual).
  syncCommands(client)
    .then((r) => console.log(`[commands] ${r === 'updated' ? 'terdaftar ulang' : 'sudah terbaru'}`))
    .catch((e) => console.error('[commands] gagal sinkron:', e.message));
  setInterval(async () => {
    const { queueExpired, sessionsExpired } = mm.sweep();
    for (const id of queueExpired) await dm(id, { embeds: [say('⌛ Belum ada lawan bicara. Coba lagi dengan `/start`.')] });
    for (const [a, b] of sessionsExpired) {
      for (const id of [a, b]) await dm(id, { embeds: [say('💤 Chat berakhir karena sepi.')] });
    }
  }, 30 * 1000).unref();
});

// Panduan otomatis saat bot diinstal ke server: kirim ke pemilik server (DM).
client.on('guildCreate', async (guild) => {
  const owner = await guild.fetchOwner().catch(() => null);
  if (owner) await dm(owner.id, { embeds: [say(config.texts.welcome)] });
});

if (require.main === module) {
  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN belum diisi (.env).');
  client.login(process.env.DISCORD_TOKEN);
}
