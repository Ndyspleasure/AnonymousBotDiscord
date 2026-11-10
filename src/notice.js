'use strict';
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
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

module.exports = { notice, ephemeral };
