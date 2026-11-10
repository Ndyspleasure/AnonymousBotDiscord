'use strict';
const { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

// Khusus User Install: command muncul di mana saja (agar bisa mengarahkan ke DM), tetapi hanya
// berfungsi di DM dengan bot. Di server/grup bot membalas link instal.
const make = (name, description) => new SlashCommandBuilder()
  .setName(name)
  .setDescription(description)
  .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel);

// Urutan = urutan tampil di daftar command.
const builders = [
  make('start', 'Masuk antrean dan dipasangkan dengan orang acak'),
  make('stop', 'Akhiri chat atau keluar dari antrean'),
  make('next', 'Akhiri chat ini dan langsung cari lawan baru'),
  make('report', 'Laporkan lawan bicara'),
  make('help', 'Tampilkan panduan penggunaan'),
  make('rules', 'Peraturan penggunaan'),
  make('terms', 'Syarat dan ketentuan'),
];

module.exports = { definitions: builders.map((b) => b.toJSON()) };
