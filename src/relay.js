'use strict';
const {
  ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const config = require('../config');

const IDS = Object.freeze({ NEXT: 'anon:next', STOP: 'anon:stop', REPORT: 'anon:report:', GO: 'anon:go' });

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
 * @param {{text?:string|null, files?:{attachment:string,name:string}[], mediaUrls?:string[], entryId:number, classic?:boolean}} o
 *  `files` = stiker + gambar/video yang diunggah ulang (galeri lewat `attachment://`, nama harus aman).
 *  `mediaUrls` = URL media langsung (mis. GIF) yang langsung ditaruh di galeri.
 * Tautan yang tidak bisa diselesaikan jadi media (atau `classic: true`) memakai pesan klasik supaya
 * tautan tetap tampil sebagai GIF (Components V2 tidak memunculkan pratinjau tautan).
 */
function buildRelay({ text = null, files = [], mediaUrls = [], entryId, classic = false }) {
  const hasMedia = files.length > 0 || mediaUrls.length > 0;
  const footer = `-# ${config.texts.footer}`;

  if (text && HAS_URL.test(text) && (classic || !hasMedia)) {
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
      ...mediaUrls.map((u) => new MediaGalleryItemBuilder().setURL(u)),
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
