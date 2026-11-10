'use strict';

const URL_RE = /https:\/\/[^\s]+/i;
const DIRECT_EXT = /\.(gif|png|jpe?g|webp|mp4)$/i;
const DIRECT_HOST = /^(media|c|i)\./i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function firstUrl(text) {
  return String(text || '').match(URL_RE)?.[0] ?? null;
}

/** URL yang sudah berupa berkas media langsung (bisa ditaruh di galeri V2). */
function isDirectMedia(raw) {
  try {
    const u = new URL(raw);
    return DIRECT_EXT.test(u.pathname) || DIRECT_HOST.test(u.hostname);
  } catch { return false; }
}

/** Ambil URL media dari embed hasil unfurl Discord (video dulu agar GIF tetap bergerak). */
function pickEmbedMedia(embeds = []) {
  const e = embeds.find((x) => x.video || x.image || x.thumbnail);
  return e?.video?.url || e?.image?.url || e?.thumbnail?.url || null;
}

/**
 * Cari media GIF dari pesan yang berisi tautan. Tautan halaman (tenor.com/view, giphy.com/gifs)
 * diselesaikan lewat embed yang Discord buat beberapa saat setelah pesan masuk.
 * @returns {Promise<{url:string, rest:string}|null>} rest = teks tanpa tautan
 */
async function resolveGif(msg, text, { tries = 3, delay = 800 } = {}) {
  const link = firstUrl(text);
  if (!link) return null;
  const rest = text.replace(link, '').trim();
  if (isDirectMedia(link)) return { url: link, rest };
  let m = msg;
  for (let n = 0; n < tries; n++) {
    const url = pickEmbedMedia(m.embeds);
    if (url) return { url, rest };
    await sleep(delay);
    m = await msg.fetch(true).catch(() => m);
  }
  return null;
}

module.exports = { firstUrl, isDirectMedia, pickEmbedMedia, resolveGif };
