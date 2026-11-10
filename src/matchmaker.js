'use strict';
const config = require('../config');

/** State murni di memori. Hilang saat restart (disengaja: tanpa penyimpanan). */
class Matchmaker {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.queue = new Map();     // userId -> joinedAt
    this.sessions = new Map();  // userId -> { partnerId, lastActivity, buffer[] }
    this.cooldowns = new Map(); // userId -> ts terakhir /mulai
    this.rate = new Map();      // userId -> [timestamps]
    this.adult = new Set();     // userId yang mengaktifkan mode 18+ (per chat)
    this.pendingMedia = new Map(); // token -> { from, to, files[], expires }
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
    this.sessions.set(a, { partnerId: b, lastActivity: t, buffer: [] });
    this.sessions.set(b, { partnerId: a, lastActivity: t, buffer: [] });
  }

  setAdult(id, on) { if (on) this.adult.add(id); else this.adult.delete(id); }
  isAdult(id) { return this.adult.has(id); }
  /** Media hanya boleh bila kedua pihak mengaktifkan mode 18+. */
  canSendMedia(id) {
    const p = this.partnerOf(id);
    return Boolean(p) && this.isAdult(id) && this.isAdult(p);
  }

  addPending(token, from, to, files) {
    this.pendingMedia.set(token, { from, to, files, expires: this.now() + config.limits.mediaPendingMs });
  }
  /** Ambil media tertunda bila penekan = penerima dan chat masih aktif. */
  takePending(token, userId) {
    const m = this.pendingMedia.get(token);
    if (!m || m.expires < this.now() || m.to !== userId || this.partnerOf(userId) !== m.from) return null;
    this.pendingMedia.delete(token);
    return m;
  }
  _clearMedia(...ids) {
    for (const id of ids) this.adult.delete(id);
    for (const [t, m] of this.pendingMedia) {
      if (ids.includes(m.from) || ids.includes(m.to)) this.pendingMedia.delete(t);
    }
  }

  /** Akhiri sesi/antrean. Mengembalikan partnerId bila ada sesi. */
  leave(id) {
    this.queue.delete(id);
    const s = this.sessions.get(id);
    if (!s) { this._clearMedia(id); return null; }
    this.sessions.delete(id);
    this.sessions.delete(s.partnerId);
    this._clearMedia(id, s.partnerId);
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

  /** Catat pesan di buffer ring kecil (hanya untuk /lapor). */
  record(id, text) {
    const s = this.sessions.get(id);
    if (!s) return;
    s.lastActivity = this.now();
    this.sessions.get(s.partnerId).lastActivity = s.lastActivity;
    const entry = { from: id, text, at: s.lastActivity };
    for (const uid of [id, s.partnerId]) {
      const buf = this.sessions.get(uid).buffer;
      buf.push(entry);
      if (buf.length > config.limits.reportBufferSize) buf.shift();
    }
  }

  snapshot(id) {
    return this.sessions.get(id)?.buffer.slice() ?? [];
  }

  /** Bersihkan antrean/sesi kedaluwarsa. Mengembalikan { queueExpired[], sessionsExpired[[a,b]] }. */
  sweep() {
    const t = this.now();
    const queueExpired = [];
    for (const [id, at] of this.queue) {
      if (t - at > config.limits.queueTimeoutMs) { this.queue.delete(id); this._clearMedia(id); queueExpired.push(id); }
    }
    const sessionsExpired = [];
    const seen = new Set();
    for (const [id, s] of this.sessions) {
      if (seen.has(id)) continue;
      if (t - s.lastActivity > config.limits.idleTimeoutMs) {
        seen.add(id); seen.add(s.partnerId);
        sessionsExpired.push([id, s.partnerId]);
      }
    }
    for (const [a, b] of sessionsExpired) { this.sessions.delete(a); this.sessions.delete(b); this._clearMedia(a, b); }
    for (const [tk, m] of this.pendingMedia) if (m.expires < t) this.pendingMedia.delete(tk);
    for (const [id, last] of this.cooldowns) {
      if (t - last > 60 * 1000) this.cooldowns.delete(id);
    }
    return { queueExpired, sessionsExpired };
  }
}

module.exports = { Matchmaker };
