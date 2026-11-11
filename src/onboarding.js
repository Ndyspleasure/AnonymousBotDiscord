'use strict';

/**
 * Sambutan pemain baru. Bot ini dipasang lewat User Install, dan Discord tidak mengirim event
 * apa pun saat pemain memasangnya, jadi saat paling awal yang bisa diketahui bot adalah ketika
 * pemain pertama kali memakai /start (atau /next) atau mengirim pesan di DM.
 *
 * Pada saat itu pemain lebih dulu diberi panduan + peraturan (config.texts.firstUse) dan belum
 * dimasukkan ke antrean. Pemain yang sudah pernah melihatnya langsung diproses seperti biasa.
 *
 * Penanda "sudah melihat" disimpan di memori dan, bila DATABASE_URL ada, di tabel anon_seen
 * (hanya ID pengguna dan waktu). Tanpa database penanda hilang saat bot restart, sehingga
 * pemain melihat sambutan itu sekali lagi.
 */
class Onboarding {
  /** @param {import('./store').PgStore|null} store */
  constructor(store = null) {
    this.store = store;
    this.seen = new Set();
  }

  has(id) { return this.seen.has(String(id)); }

  /** Tandai sudah melihat sambutan. @returns {boolean} true bila baru ditandai. */
  mark(id, at = Date.now()) {
    const key = String(id);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.store?.markSeen(key, at);
    return true;
  }

  restore(ids = []) { for (const id of ids) this.seen.add(String(id)); }

  /**
   * Perlu sambutan? Hanya pemain yang belum pernah melihatnya dan tidak sedang antre atau
   * berada di chat (chat yang dipulihkan dari database tidak boleh terganggu).
   * @param {{isInSession:(id:string)=>boolean, isQueued:(id:string)=>boolean}} mm
   */
  needsFirstUse(id, mm) {
    return !this.has(id) && !mm.isInSession(String(id)) && !mm.isQueued(String(id));
  }
}

module.exports = { Onboarding };
