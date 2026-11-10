'use strict';
const {
  ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const config = require('../config');

const IDS = Object.freeze({ NEXT: 'anon:next', STOP: 'anon:stop', REPORT: 'anon:report:' });

function actionRow(entryId, hasMedia) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(IDS.NEXT).setLabel('Next').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(IDS.STOP).setLabel('Stop').setEmoji('🛑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${IDS.REPORT}${entryId}`)
      .setLabel(hasMedia ? 'Laporkan pesan ini' : 'Report').setEmoji('🚩').setStyle(ButtonStyle.Danger),
  );
}

const HAS_URL = /https:\/\//i;

/**
 * Susun pesan relay dengan tombol Next/Stop/Report dan footer.
 * @param {{text?:string|null, files?:{attachment:string,name:string}[], entryId:number}} o
 *  `files` = stiker + gambar/video; tampil di galeri. Nama berkas harus aman untuk `attachment://`.
 * Pesan berisi tautan GIF memakai pesan klasik agar tautan tetap tampil sebagai GIF
 * (Components V2 tidak memunculkan pratinjau tautan).
 */
function buildRelay({ text = null, files = [], entryId }) {
  const hasMedia = files.length > 0;
  const footer = `-# ${config.texts.footer}`;

  if (text && HAS_URL.test(text) && !hasMedia) {
    return {
      content: `**Stranger:**\n${text}\n${footer}`,
      components: [actionRow(entryId, false)],
      allowedMentions: { parse: [] },
    };
  }

  const box = new ContainerBuilder().setAccentColor(config.brand.color);
  const head = text ? `**Stranger:**\n${text}` : '**Stranger** mengirim media:';
  box.addTextDisplayComponents(new TextDisplayBuilder().setContent(head));
  if (hasMedia) {
    box.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
      ...files.map((f) => new MediaGalleryItemBuilder().setURL(`attachment://${f.name}`)),
    ));
  }
  box.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  box.addActionRowComponents(actionRow(entryId, hasMedia));
  box.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [box],
    files,
    allowedMentions: { parse: [] },
  };
}

module.exports = { IDS, buildRelay };
