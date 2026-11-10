'use strict';
const config = require('../config');

const LINK_RE = /(https?:\/\/|www\.|discord\.gg\/|discord(app)?\.com\/invite)/i;

/** Mengembalikan { ok, text, reason }. Teks dinetralkan dari mention. */
function checkMessage(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: false, reason: 'Hanya pesan teks yang bisa dikirim.' };
  if (text.length > config.limits.maxMessageLength) {
    return { ok: false, reason: `Pesan terlalu panjang (maks ${config.limits.maxMessageLength} karakter).` };
  }
  if (LINK_RE.test(text)) return { ok: false, reason: 'Tautan tidak diizinkan demi keamanan.' };
  const lower = text.toLowerCase();
  if (config.blockedWords.some((w) => w && lower.includes(w))) {
    return { ok: false, reason: 'Pesan mengandung kata yang diblokir.' };
  }
  // netralkan mention (@everyone, <@id>, dst.) agar tidak membocorkan/menyalahgunakan
  const safe = text.replace(/@/g, '@​').replace(/<(#|@|a?:)/g, '<​$1');
  return { ok: true, text: safe };
}

module.exports = { checkMessage };
