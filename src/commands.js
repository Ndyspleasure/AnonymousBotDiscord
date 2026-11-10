'use strict';
const { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

// integration_types user+guild & contexts DM/bot-DM/guild => bisa dipakai tanpa server.
const anon = new SlashCommandBuilder()
  .setName('anon')
  .setDescription('Chat anonim 1-1 lewat DM')
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
  .addSubcommand((s) => s.setName('mulai').setDescription('Cari lawan bicara anonim'))
  .addSubcommand((s) => s.setName('lewati').setDescription('Akhiri chat ini dan cari lawan baru'))
  .addSubcommand((s) => s.setName('stop').setDescription('Akhiri chat / keluar antrean'))
  .addSubcommand((s) => s.setName('dewasa').setDescription('Mode 18+ untuk kirim/terima gambar & video (hilang saat chat berakhir)')
    .addBooleanOption((o) => o.setName('aktif').setDescription('Aktifkan (kamu menyatakan berusia 18+)').setRequired(true)))
  .addSubcommand((s) => s.setName('lapor').setDescription('Laporkan lawan bicara ke moderator'))
  .addSubcommand((s) => s.setName('bantuan').setDescription('Panduan penggunaan'));

module.exports = { definitions: [anon.toJSON()] };
