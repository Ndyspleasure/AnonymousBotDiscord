'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, MessageFlags, EmbedBuilder } = require('discord.js');
const config = require('./config');
const { Matchmaker } = require('./src/matchmaker');
const { checkMessage } = require('./src/filter');

const mm = new Matchmaker();
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

async function sendReport(reporterId, partnerId, buffer) {
  const url = process.env.REPORT_WEBHOOK_URL;
  if (!url) return false;
  const lines = buffer.map((m) => `<${m.from === reporterId ? 'pelapor' : 'terlapor'}> ${m.text}`).join('\n').slice(0, 3500);
  const body = {
    embeds: [{
      title: '🚩 Laporan Anonymous Chat',
      description: `Pelapor: \`${reporterId}\`\nTerlapor: \`${partnerId}\`\n\n${lines || '(tidak ada pesan)'}`,
      color: 0xed4245,
    }],
  };
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.ok;
  } catch { return false; }
}

async function handleAnon(i) {
  const id = i.user.id;
  const sub = i.options.getSubcommand();
  const reply = (text) => i.reply({ embeds: [say(text)], flags: MessageFlags.Ephemeral });

  if (mm.isBanned(id)) return reply('⛔ Kamu tidak dapat menggunakan bot ini.');

  if (sub === 'bantuan') return reply(config.texts.welcome);

  if (sub === 'mulai' || sub === 'lewati') {
    if (sub === 'lewati') {
      const p = mm.leave(id);
      await endBoth(id, p, '👋 Lawan bicaramu mengakhiri chat. Ketik `/anon mulai` untuk cari lagi.');
      mm.cooldowns.delete(id);
    }
    const r = mm.join(id);
    if (r.status === 'cooldown') return reply('⏳ Tunggu sebentar sebelum mencari lagi.');
    if (r.status === 'busy') return reply('Kamu sedang dalam chat/antrean. Pakai `/anon stop` untuk berhenti.');
    if (r.status === 'queued') {
      // pastikan bot bisa DM user ini
      const ok = await dm(id, { embeds: [say('🔎 Mencari lawan bicara… Kamu akan diberi tahu di DM ini saat cocok.')] });
      if (!ok) { mm.leave(id); return reply('❌ Bot tidak bisa mengirim DM. Buka profil bot → **Kirim Pesan**, lalu coba lagi.'); }
      greeted.add(id);
      return reply('🔎 Masuk antrean. Cek DM dari bot ini.');
    }
    // matched
    const matchMsg = '✅ **Terhubung!** Kirim pesan biasa di DM ini. `/anon lewati` · `/anon stop` · `/anon lapor`';
    const okPartner = await dm(r.partnerId, { embeds: [say(matchMsg)] });
    if (!okPartner) { mm.leave(id); return reply('Lawan bicara tidak dapat dihubungi. Coba `/anon mulai` lagi.'); }
    await dm(id, { embeds: [say(matchMsg)] });
    greeted.add(id);
    return reply('✅ Terhubung! Lanjutkan di DM bot ini.');
  }

  if (sub === 'stop') {
    const wasQueued = mm.isQueued(id);
    const p = mm.leave(id);
    if (!p && !wasQueued) return reply('Kamu tidak sedang dalam chat.');
    await endBoth(id, p, '👋 Lawan bicaramu mengakhiri chat.');
    return reply('🛑 Selesai. Ketik `/anon mulai` kapan saja.');
  }

  if (sub === 'lapor') {
    const p = mm.partnerOf(id);
    if (!p) return reply('Tidak ada chat aktif untuk dilaporkan.');
    const ok = await sendReport(id, p, mm.snapshot(id));
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
    else if (!mm.isQueued(id)) await msg.channel.send({ embeds: [say('Belum ada chat aktif. Ketik `/anon mulai`.')] }).catch(() => {});
    return;
  }
  if (msg.attachments.size || msg.stickers?.size) { await msg.reply('⚠️ Hanya teks yang diizinkan.').catch(() => {}); return; }
  const c = checkMessage(msg.content);
  if (!c.ok) { await msg.reply(`⚠️ ${c.reason}`).catch(() => {}); return; }
  if (!mm.allowMessage(id)) { await msg.reply('⏳ Terlalu cepat, pelan-pelan ya.').catch(() => {}); return; }
  const sent = await dm(partner, { content: `💬 **Stranger:** ${c.text}`, allowedMentions: { parse: [] } });
  if (!sent) { mm.leave(id); await msg.reply('❌ Lawan bicara tidak dapat dihubungi. Chat diakhiri.').catch(() => {}); return; }
  mm.record(id, c.text);
  msg.react('✅').catch(() => {});
}

client.on('interactionCreate', (i) => {
  if (i.isChatInputCommand() && i.commandName === 'anon') {
    handleAnon(i).catch((e) => console.error('[anon]', e));
  }
});

client.on('messageCreate', (m) => {
  if (m.author.bot || !m.channel.isDMBased()) return;
  handleDM(m).catch((e) => console.error('[dm]', e));
});

client.once('clientReady', () => {
  console.log(`✅ ${client.user.tag} online`);
  setInterval(async () => {
    const { queueExpired, sessionsExpired } = mm.sweep();
    for (const id of queueExpired) await dm(id, { embeds: [say('⌛ Belum ada lawan bicara. Coba lagi dengan `/anon mulai`.')] });
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
