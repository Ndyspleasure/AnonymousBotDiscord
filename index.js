'use strict';
require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, StickerFormatType, InteractionContextType,
} = require('discord.js');
const config = require('./config');
const { Matchmaker } = require('./src/matchmaker');
const { checkMessage } = require('./src/filter');
const { syncCommands } = require('./src/registerCommands');
const { sendTranscriptFile } = require('./src/report');
const { IDS, buildRelay } = require('./src/relay');
const { resolveGif } = require('./src/gif');
const { notice, ephemeral, installNotice } = require('./src/notice');
const { PgStore, createPool } = require('./src/store');

const mm = new Matchmaker();
// Transkrip dikirim ke log moderasi setiap chat berakhir. Laporan memakai REPORT_WEBHOOK_URL
// (cadangan: LOG_WEBHOOK_URL). Tanpa webhook, tidak ada yang dikirim.
mm.onEnd = (info) => sendTranscriptFile(
  info.reporterId ? (process.env.REPORT_WEBHOOK_URL || process.env.LOG_WEBHOOK_URL) : process.env.LOG_WEBHOOK_URL,
  info,
);
const COMMANDS = new Set(require('./src/commands').definitions.map((d) => d.name));

const client = new Client({
  // DM tidak butuh intent privileged (MessageContent) untuk membaca isi pesan.
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel, Partials.Message],
});

async function dm(userId, payload) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(payload);
    return true;
  } catch { return false; }
}

async function endBoth(userId, partnerId, reasonToPartner) {
  if (partnerId && reasonToPartner) await dm(partnerId, notice(reasonToPartner));
}

/** Dipakai slash command dan tombol (Next/Stop/Report). `arg` = id pesan untuk Report. */
async function handleCommand(i, sub = i.commandName, arg = null) {
  const id = i.user.id;
  // Bot khusus DM: command di server/grup dijawab link instal (ephemeral), tidak diproses.
  const inBotDm = i.context === InteractionContextType.BotDM || (i.context == null && !i.inGuild());
  if (!inBotDm) {
    return i.reply(ephemeral(installNotice(process.env.CLIENT_ID || client.application.id)));
  }
  // Balasan tampil biasa (permanen) seperti informasi.
  const reply = (text) => i.reply(notice(text));

  if (mm.isBanned(id)) return reply('⛔ Kamu tidak dapat menggunakan bot ini.');

  if (sub === 'help') return reply(config.texts.welcome);
  if (sub === 'rules') return reply(config.texts.rules);
  if (sub === 'terms') return reply(config.texts.terms);

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
      return reply('🔎 Mencari lawan bicara… Kamu akan diberi tahu di DM ini saat cocok.');
    }
    // matched: pasangan diberi tahu lewat DM, kamu lewat balasan ini
    const matchMsg = '✅ **Terhubung!** Kirim pesan biasa di DM ini. `/next` · `/stop` · `/report`';
    const okPartner = await dm(r.partnerId, notice(matchMsg));
    if (!okPartner) { mm.leave(id, { reason: 'unreachable' }); return reply('Lawan bicara tidak dapat dihubungi. Coba `/start` lagi.'); }
    return reply(matchMsg);
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
    let flaggedId = null;
    if (arg != null) {
      const entry = mm.findEntry(id, arg);
      if (!entry || entry.from !== p) return reply('Pesan ini bukan bagian dari chat yang sedang aktif.');
      flaggedId = entry.id;
    }
    mm.lastEnd = null;
    mm.leave(id, { reporterId: id, flaggedId });
    const ok = (await mm.lastEnd) === true;
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
    // Tanpa chat aktif. Setelah bot restart semua orang tampak "baru", jadi jelaskan kemungkinannya.
    if (!mm.isQueued(id)) await msg.channel.send(notice(config.texts.noChat)).catch(() => {});
    return;
  }
  const warn = (t) => msg.reply(notice(`⚠️ ${t}`)).catch(() => {});
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

  // Foto & video (maks 4 file, 8 MB). Nama berkas dibuat aman untuk attachment://.
  const files = [];
  const mediaMeta = [];
  if (hasMedia) {
    const list = [...msg.attachments.values()];
    if (list.length > config.limits.maxMediaPerMessage) return warn(`Maksimal ${config.limits.maxMediaPerMessage} file per pesan.`);
    if (list.some((a) => !/^(image|video)\//.test(a.contentType || ''))) return warn(config.texts.unsupported);
    if (list.some((a) => a.size > config.limits.maxMediaBytes)) return warn(`Ukuran maksimal ${Math.floor(config.limits.maxMediaBytes / 1048576)} MB per file.`);
    list.forEach((a, n) => {
      const ext = (a.name?.match(/\.([a-z0-9]{1,5})$/i)?.[1] || (a.contentType.startsWith('video/') ? 'mp4' : 'png')).toLowerCase();
      const name = `media${n + 1}.${ext}`;
      files.push({ attachment: a.url, name });
      mediaMeta.push({ name, url: a.url });
    });
  }

  // Stiker: dikirim sebagai gambar (Lottie tidak didukung).
  if (hasSticker) {
    let n = 0;
    for (const st of msg.stickers.values()) {
      if (st.format === StickerFormatType.Lottie) return warn(config.texts.unsupported);
      const ext = st.format === StickerFormatType.GIF ? 'gif' : 'png';
      const name = `stiker${++n}.${ext}`;
      files.push({ attachment: st.url, name });
      mediaMeta.push({ name: `${st.name || 'stiker'} (stiker)`, url: st.url });
    }
  }

  // Tautan GIF: jadikan media di kartu V2 bila bisa diselesaikan, kalau tidak pakai pesan klasik.
  let relayText = text;
  const mediaUrls = [];
  if (text && !hasMedia) {
    const gif = await resolveGif(msg, text);
    if (gif) { mediaUrls.push(gif.url); relayText = gif.rest || null; mediaMeta.push({ name: 'gif', url: gif.url }); }
  }

  // Catat dulu supaya tombol Report tahu pesan mana yang dilaporkan.
  const entry = mm.record(id, text, mediaMeta);
  let sent = await dm(partner, buildRelay({ text: relayText, files, mediaUrls, entryId: entry.id }));
  // Bila Discord menolak kartu V2 berisi GIF, kirim ulang sebagai pesan klasik dengan tautannya.
  if (!sent && mediaUrls.length) sent = await dm(partner, buildRelay({ text, entryId: entry.id, classic: true }));
  if (!sent) { mm.leave(id, { reason: 'unreachable' }); return warn('❌ Lawan bicara tidak dapat dihubungi. Chat diakhiri.'); }
  msg.react('✅').catch(() => {});
}

client.on('interactionCreate', (i) => {
  if (i.isButton() && i.customId.startsWith('anon:')) {
    let action = null;
    let arg = null;
    if (i.customId === IDS.NEXT) action = 'next';
    else if (i.customId === IDS.STOP) action = 'stop';
    else if (i.customId.startsWith(IDS.REPORT)) { action = 'report'; arg = Number(i.customId.slice(IDS.REPORT.length)); }
    if (action) handleCommand(i, action, arg).catch((e) => console.error(`[btn:${action}]`, e));
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
  // Chat yang dipulihkan dari database: beri tahu bahwa bot baru menyala (pesan saat bot mati tidak terkirim).
  if (resumed.users.length) {
    Promise.allSettled(resumed.users.map((id) => dm(id, notice(config.texts.resumedNotice))));
  }
  // Pendaftaran command otomatis (tanpa perlu `node deploy-commands.js` manual).
  syncCommands(client)
    .then((r) => console.log(`[commands] ${r === 'updated' ? 'terdaftar ulang' : 'sudah terbaru'}`))
    .catch((e) => console.error('[commands] gagal sinkron:', e.message));
  setInterval(async () => {
    const { queueExpired, sessionsExpired } = mm.sweep();
    for (const id of queueExpired) await dm(id, notice('⌛ Belum ada lawan bicara. Coba lagi dengan `/start`.'));
    for (const [a, b] of sessionsExpired) {
      for (const id of [a, b]) await dm(id, notice('💤 Chat berakhir karena sepi.'));
    }
  }, 30 * 1000).unref();
});

// ─── Shutdown/crash terkendali ──────────────────────────────────────────────
// Saat dimatikan (SIGTERM/SIGINT dari panel hosting) atau crash yang tertangkap, beri tahu semua
// pengguna yang sedang chat/antre dan kirim transkrip chat yang masih berjalan ke log.
// Mati paksa (SIGKILL, kehabisan memori, listrik padam) tidak bisa ditangani.
let shuttingDown = false;
async function shutdown(reason, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (mm.store) {
      // Status chat sudah tersimpan di database: cukup selesaikan penulisan tertunda. Chat dilanjutkan
      // otomatis saat bot menyala lagi (pengguna diberi tahu di sana).
      await Promise.race([mm.store.flush(), new Promise((r) => setTimeout(r, 5000))]);
    } else {
      const { users, queued, ends } = mm.endAll(reason);
      const text = reason === 'crash' ? config.texts.crashNotice : config.texts.restartNotice;
      const work = Promise.allSettled([
        ...[...users, ...queued].map((id) => dm(id, notice(text))),
        ...ends,
      ]);
      await Promise.race([work, new Promise((r) => setTimeout(r, 8000))]);
    }
  } catch { /* abaikan, tetap keluar */ }
  process.exit(code);
}

/** Sambungkan PostgreSQL bila DATABASE_URL ada; gagal = lanjut tanpa penyimpanan (hanya memori). */
async function setupStore() {
  if (!process.env.DATABASE_URL) { console.log('[store] DATABASE_URL kosong: hanya memori (chat putus saat restart).'); return; }
  try {
    const store = new PgStore(createPool());
    await store.init();
    const state = await store.load(config.limits.transcriptMaxEntries);
    mm.store = store;
    resumed = mm.restore(state);
    console.log(`[store] terhubung. Dipulihkan: ${state.chats.length} chat, ${state.queue.length} antre.`);
  } catch (e) {
    console.error('[store] gagal terhubung, lanjut hanya memori:', e.message);
  }
}
let resumed = { users: [], queued: [] };

if (require.main === module) {
  process.on('SIGTERM', () => shutdown('restart'));
  process.on('SIGINT', () => shutdown('restart'));
  process.on('uncaughtException', (e) => { console.error('[fatal]', e); shutdown('crash', 1); });
  process.on('unhandledRejection', (e) => { console.error('[fatal]', e); shutdown('crash', 1); });

  if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN belum diisi (.env).');
  setupStore().then(() => client.login(process.env.DISCORD_TOKEN));
}
