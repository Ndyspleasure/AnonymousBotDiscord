'use strict';
/**
 * Penyimpanan status chat di PostgreSQL (mis. Aiven) agar chat tidak terputus saat bot restart.
 * Memori tetap sumber utama (cepat, sinkron); penulisan ke database berjalan di latar belakang
 * secara berurutan. Bila database tidak tersedia, bot tetap jalan hanya dengan memori.
 *
 * Yang disimpan: ID pengguna, waktu, riwayat pesan teks, dan tautan media sementara. Baris chat
 * dihapus saat chat berakhir (setelah transkrip dikirim ke log moderasi).
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS anon_chats (
     id            TEXT PRIMARY KEY,
     user_a        TEXT   NOT NULL,
     user_b        TEXT   NOT NULL,
     started_at    BIGINT NOT NULL,
     last_activity BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS anon_history (
     id        BIGINT PRIMARY KEY,
     chat_id   TEXT   NOT NULL REFERENCES anon_chats(id) ON DELETE CASCADE,
     from_user TEXT   NOT NULL,
     body      TEXT,
     media     TEXT   NOT NULL DEFAULT '[]',
     at        BIGINT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS anon_history_chat_idx ON anon_history (chat_id, id)',
  `CREATE TABLE IF NOT EXISTS anon_queue (
     user_id   TEXT PRIMARY KEY,
     joined_at BIGINT NOT NULL
   )`,
  // Akses lewat API data publik ditutup; hanya koneksi langsung yang memakai tabel ini.
  'ALTER TABLE anon_chats ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE anon_history ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE anon_queue ENABLE ROW LEVEL SECURITY',
];

class PgStore {
  /** @param {{query:(text:string, params?:any[])=>Promise<{rows:any[]}>}} db  pg.Pool atau PGlite */
  constructor(db, log = console) {
    this.db = db;
    this.log = log;
    this._q = Promise.resolve();
  }

  async init() {
    for (const sql of SCHEMA) await this.db.query(sql);
  }

  /** Antrekan penulisan agar urutannya terjaga; kegagalan hanya dicatat. */
  _enqueue(sql, params) {
    this._q = this._q
      .then(() => this.db.query(sql, params))
      .catch((e) => this.log.error('[store] gagal menulis:', e.message));
    return this._q;
  }

  /** Tunggu semua penulisan tertunda (dipakai saat shutdown). */
  flush() { return this._q; }

  saveChat(chat) {
    return this._enqueue(
      'INSERT INTO anon_chats (id, user_a, user_b, started_at, last_activity) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
      [chat.id, chat.users[0], chat.users[1], chat.startedAt, chat.lastActivity],
    );
  }

  addHistory(chat, entry) {
    this._enqueue(
      'INSERT INTO anon_history (id, chat_id, from_user, body, media, at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
      [entry.id, chat.id, entry.from, entry.text ?? null, JSON.stringify(entry.media || []), entry.at],
    );
    return this._enqueue('UPDATE anon_chats SET last_activity = $1 WHERE id = $2', [chat.lastActivity, chat.id]);
  }

  deleteChat(chatId) {
    return this._enqueue('DELETE FROM anon_chats WHERE id = $1', [chatId]);
  }

  addQueue(userId, joinedAt) {
    return this._enqueue(
      'INSERT INTO anon_queue (user_id, joined_at) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET joined_at = EXCLUDED.joined_at',
      [userId, joinedAt],
    );
  }

  removeQueue(userId) {
    return this._enqueue('DELETE FROM anon_queue WHERE user_id = $1', [userId]);
  }

  /** Muat seluruh status untuk dipulihkan ke memori saat bot menyala. */
  async load(maxHistory = 500) {
    const chats = (await this.db.query('SELECT id, user_a, user_b, started_at, last_activity FROM anon_chats')).rows;
    const hist = (await this.db.query('SELECT id, chat_id, from_user, body, media, at FROM anon_history ORDER BY id')).rows;
    const byChat = new Map(chats.map((c) => [c.id, []]));
    let maxId = 0;
    for (const h of hist) {
      const id = Number(h.id);
      if (id > maxId) maxId = id;
      byChat.get(h.chat_id)?.push({
        id, from: h.from_user, text: h.body, media: JSON.parse(h.media || '[]'), at: Number(h.at),
      });
    }
    const queue = (await this.db.query('SELECT user_id, joined_at FROM anon_queue')).rows
      .map((r) => ({ userId: r.user_id, joinedAt: Number(r.joined_at) }));
    return {
      maxId,
      queue,
      chats: chats.map((c) => ({
        id: c.id,
        users: [c.user_a, c.user_b],
        startedAt: Number(c.started_at),
        lastActivity: Number(c.last_activity),
        history: byChat.get(c.id).slice(-maxHistory),
      })),
    };
  }
}

/**
 * Buat koneksi pg.Pool dari env. Aiven: salin "Service URI" ke DATABASE_URL. Verifikasi sertifikat
 * dengan DATABASE_CA (isi ca.pem); tanpa itu koneksi tetap terenkripsi TLS tetapi server tidak
 * diautentikasi (setara sslmode=require).
 */
function createPool(env = process.env) {
  const { Pool } = require('pg');
  const url = new URL(env.DATABASE_URL);
  url.searchParams.delete('sslmode'); // pg memberi prioritas ke URL; atur `ssl` sendiri di bawah
  const ssl = env.DATABASE_CA
    ? { ca: env.DATABASE_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
  // Paket gratis Aiven: max_connections 20 (±14 untuk aplikasi), tanpa connection pooling.
  return new Pool({ connectionString: url.toString(), ssl, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
}

module.exports = { PgStore, createPool, SCHEMA };
