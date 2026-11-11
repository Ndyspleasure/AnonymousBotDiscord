'use strict';
const {
  ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const config = require('../config');

/** Pesan info/peringatan bot sebagai kartu Components V2 (menggantikan embed). */
function notice(text) {
  const box = new ContainerBuilder()
    .setAccentColor(config.brand.color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(String(text).slice(0, 3900)));
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [box],
    allowedMentions: { parse: [] },
  };
}

/** Jadikan payload ephemeral (hanya terlihat oleh pemakai command/tombol). */
function ephemeral(payload) {
  return { ...payload, flags: payload.flags | MessageFlags.Ephemeral };
}

/** Kartu sambutan pemain baru: panduan + peraturan, dengan tombol yang sama artinya dengan /start. */
function firstUseNotice() {
  const { IDS } = require('./relay');
  const box = new ContainerBuilder()
    .setAccentColor(config.brand.color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(config.texts.firstUse.slice(0, 3900)))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(IDS.GO).setStyle(ButtonStyle.Success).setLabel('Mengerti, mulai cari lawan').setEmoji('▶️'),
    ));
  return { flags: MessageFlags.IsComponentsV2, components: [box], allowedMentions: { parse: [] } };
}

/** Link User Install (dipakai di DM, tanpa server). */
const installUrl = (clientId) =>
  `https://discord.com/oauth2/authorize?client_id=${clientId}&integration_type=1&scope=applications.commands`;

/** Pesan arahan instal untuk command yang dijalankan di luar DM bot (server, grup). */
function installNotice(clientId) {
  const box = new ContainerBuilder()
    .setAccentColor(config.brand.color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(config.texts.dmOnly))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(installUrl(clientId)).setLabel('Instal ke akunmu').setEmoji('🕶️'),
    ));
  return { flags: MessageFlags.IsComponentsV2, components: [box], allowedMentions: { parse: [] } };
}

module.exports = { notice, ephemeral, firstUseNotice, installNotice, installUrl };
