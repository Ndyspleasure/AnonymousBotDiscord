'use strict';
const config = require('../config');
const { msg: say } = require('./messages');

const CUSTOM_EMOJI_RE = /<a?:\w+:\d+>/;
const INVITE_RE = /(discord\.gg\/|discord(app)?\.com\/invite)/i;
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/gi;

/** Hanya https dan host GIF yang diizinkan (config.gifHosts). */
function urlAllowed(raw) {
  try {
    const u = new URL(raw.startsWith('www.') ? `https://${raw}` : raw);
    if (u.protocol !== 'https:') return false;
    return config.gifHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch { return false; }
}

/** Mengembalikan { ok, text, reason }. Teks dinetralkan dari mention. */
function checkMessage(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, reason: say('empty') };
  if (text.length > config.limits.maxMessageLength) {
    return { ok: false, reason: say('tooLong') };
  }
  if (CUSTOM_EMOJI_RE.test(text)) return { ok: false, reason: config.texts.noCustomEmoji };
  if (INVITE_RE.test(text)) return { ok: false, reason: config.texts.unsupported };
  const urls = text.match(URL_RE) || [];
  if (urls.some((u) => !urlAllowed(u))) {
    return { ok: false, reason: config.texts.unsupported };
  }
  const lower = text.toLowerCase();
  if (config.blockedWords.some((w) => w && lower.includes(w))) {
    return { ok: false, reason: say('blockedWord') };
  }
  // netralkan mention (@everyone, <@id>, dst.) agar tidak membocorkan/menyalahgunakan
  const safe = text.replace(/@/g, '@​').replace(/<(#|@|a?:)/g, '<​$1');
  return { ok: true, text: safe };
}

module.exports = { checkMessage };
