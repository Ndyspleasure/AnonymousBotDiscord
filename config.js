'use strict';
// Semua "data" bot ada di sini (tanpa database). Ubah lalu deploy ulang.
module.exports = {
  brand: { name: 'Anonymous Bot', color: 0x5865f2, hubName: 'Vanillate.ID' },

  limits: {
    queueTimeoutMs: 5 * 60 * 1000,     // keluar antrean otomatis
    idleTimeoutMs: 30 * 60 * 1000,     // sesi diakhiri bila sepi
    startCooldownMs: 5 * 1000,         // jeda antar /anon mulai
    msgPerWindow: 8,                   // maks pesan ...
    msgWindowMs: 10 * 1000,            // ... per jendela waktu ini
    maxMessageLength: 1000,
    reportBufferSize: 10,              // pesan terakhir yang ikut dilaporkan
    maxMediaBytes: 8 * 1024 * 1024,    // maks ukuran gambar/video
    maxMediaPerMessage: 4,
    mediaPendingMs: 15 * 60 * 1000,    // batas waktu tombol Tampilkan
  },

  // Tautan yang diizinkan hanya untuk GIF dari menu GIF Discord.
  gifHosts: ['tenor.com', 'giphy.com'],

  // ID user yang diblokir permanen (hardcode). Contoh: '123456789012345678'
  bannedUserIds: [],

  // Kata yang diblokir (huruf kecil). Tambahkan sesuai kebutuhan.
  blockedWords: [],

  texts: {
    welcome: [
      '👋 **Selamat datang di Anonymous Bot!**',
      '',
      'Ngobrol 1-1 dengan orang acak, identitas kalian **tidak** ditampilkan.',
      '',
      '**Cara pakai**',
      '1. Ketik `/anon mulai` untuk masuk antrean.',
      '2. Setelah cocok, **kirim pesan biasa di DM ini** — bot meneruskannya.',
      '3. `/anon lewati` cari lawan baru · `/anon stop` berhenti · `/anon lapor` laporkan.',
      '',
      '**Boleh dikirim**: teks, emoji, stiker, dan GIF (menu GIF Discord).',
      '**Gambar & video** hanya bila KEDUA pihak mengaktifkan `/anon dewasa` (khusus usia 18+). Penerima harus menekan **Tampilkan** dulu. Mode ini mati otomatis saat chat berakhir.',
      '**Aturan**: sopan, tanpa spam/SARA/doxxing. Dilarang keras konten yang melibatkan anak di bawah umur. Tautan lain diblokir.',
      '🔒 Bot **tidak menyimpan** percakapan. Moderator hanya menerima potongan chat bila kamu menekan `/anon lapor`.',
    ].join('\n'),
  },
};
