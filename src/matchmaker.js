'use strict';
const config = require('../config');

/**
 * State di memori: antrean, sesi, dan riwayat chat aktif. Tanpa database; hilang saat restart.
 * Saat sebuah chat berakhir, `onEnd(info)` dipanggil sekali dengan seluruh riwayatnya
 * (dipakai untuk mengirim transkrip ke log moderasi).
 */
class Matchmaker {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.queue = new Map();     // userId -> joinedAt
    this.sessions = new Map();  // userId -> { partnerId, chat }
    this.cooldowns = new Map(); // userId -> ts terakhir /start
    this.rate = new Map();      // userId -> [timestamps]
    this.seq = 0;               // id pesan untuk tombol Report
    this.onEnd = null;          // (info) => Promise|void
    this.lastEnd = null;        // hasil onEnd terakhir (untuk menunggu pengiriman laporan)
  }

  isBanned(id) { return config.bannedUserIds.includes(id); }
  isInSession(id) { return this.sessions.has(id); }
  isQueued(id) { return this.queue.has(id); }
  partnerOf(id) { return this.sessions.get(id)?.partnerId ?? null; }

  /** @returns {{status:'cooldown'|'busy'|'queued'|'matched', partnerId?:string}} */
  join(id) {
    if (this.isInSession(id) || this.isQueued(id)) return { status: 'busy' };
    const last = this.cooldowns.get(id) ?? 0;
    if (this.now() - last < config.limits.startCooldownMs) return { status: 'cooldown' };
    this.cooldowns.set(id, this.now());
    for (const [other] of this.queue) {
      if (other === id) continue;
      this.queue.delete(other);
      this._pair(id, other);
      return { status: 'matched', partnerId: other };
    }
    this.queue.set(id, this.now());
    return { status: 'queued' };
  }

  _pair(a, b) {
    const t = this.now();
    const chat = { users: [a, b], startedAt: t, lastActivity: t, history: [] };
    this.sessions.set(a, { partnerId: b, chat });
    this.sessions.set(b, { partnerId: a, chat });
  }

  _finish(chat, reason, meta = {}) {
    for (const u of chat.users) this.sessions.delete(u);
    if (!this.onEnd || !chat.history.length) return;
    this.lastEnd = Promise.resolve(this.onEnd({
      users: chat.users, startedAt: chat.startedAt, endedAt: this.now(), history: chat.history, reason, ...meta,
    })).catch(() => false);
  }

  /**
   * Akhiri sesi/antrean. Mengembalikan partnerId bila ada sesi.
   * `meta` (mis. { reporterId, flaggedId }) diteruskan ke onEnd.
   */
  leave(id, meta = {}) {
    this.queue.delete(id);
    const s = this.sessions.get(id);
    if (!s) return null;
    this._finish(s.chat, meta.reason || (meta.reporterId ? 'report' : 'ended'), meta);
    return s.partnerId;
  }

  /** Rate limit pesan. true = boleh. */
  allowMessage(id) {
    const { msgPerWindow, msgWindowMs } = config.limits;
    const t = this.now();
    const arr = (this.rate.get(id) || []).filter((x) => t - x < msgWindowMs);
    if (arr.length >= msgPerWindow) { this.rate.set(id, arr); return false; }
    arr.push(t); this.rate.set(id, arr);
    return true;
  }

  /** Catat pesan di riwayat chat (untuk transkrip & laporan). Mengembalikan entri (id unik). */
  record(id, text, media = []) {
    const s = this.sessions.get(id);
    if (!s) return null;
    const { chat } = s;
    chat.lastActivity = this.now();
    const entry = { id: ++this.seq, from: id, text, media, at: chat.lastActivity };
    chat.history.push(entry);
    if (chat.history.length > config.limits.transcriptMaxEntries) chat.history.shift();
    return entry;
  }

  /** Entri di chat aktif milik userId (untuk tombol Report). */
  findEntry(userId, entryId) {
    return this.sessions.get(userId)?.chat.history.find((e) => e.id === entryId) ?? null;
  }

  /** Bersihkan antrean/sesi kedaluwarsa. Mengembalikan { queueExpired[], sessionsExpired[[a,b]] }. */
  sweep() {
    const t = this.now();
    const queueExpired = [];
    for (const [id, at] of this.queue) {
      if (t - at > config.limits.queueTimeoutMs) { this.queue.delete(id); queueExpired.push(id); }
    }
    const sessionsExpired = [];
    const seen = new Set();
    for (const [, s] of this.sessions) {
      if (seen.has(s.chat)) continue;
      seen.add(s.chat);
      if (t - s.chat.lastActivity > config.limits.idleTimeoutMs) sessionsExpired.push(s.chat);
    }
    for (const chat of sessionsExpired) this._finish(chat, 'idle');
    for (const [id, last] of this.cooldowns) {
      if (t - last > 60 * 1000) this.cooldowns.delete(id);
    }
    return { queueExpired, sessionsExpired: sessionsExpired.map((c) => c.users) };
  }
}

module.exports = { Matchmaker };
