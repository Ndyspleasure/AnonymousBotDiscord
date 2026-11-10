'use strict';
const FOOTER = 'Patuhi syarat dan ketentuan kami, pelanggar dapat dikenakan sanksi banned permanen';
// Konfigurasi dan teks bot ada di sini. Status chat disimpan di memori dan (opsional) PostgreSQL, lihat src/store.js. Ubah lalu deploy ulang.
module.exports = {
  brand: { name: 'Anonymous Bot', color: 0x5865f2, hubName: 'Vanillate.ID' },

  limits: {
    queueTimeoutMs: 5 * 60 * 1000,     // keluar antrean otomatis
    idleTimeoutMs: 30 * 60 * 1000,     // sesi diakhiri bila sepi
    startCooldownMs: 5 * 1000,         // jeda antar /start
    msgPerWindow: 8,                   // maks pesan ...
    msgWindowMs: 10 * 1000,            // ... per jendela waktu ini
    maxMessageLength: 1000,
    transcriptMaxEntries: 500,         // maks pesan per chat yang disimpan di memori untuk transkrip
    maxMediaBytes: 8 * 1024 * 1024,    // maks ukuran gambar/video
    maxMediaPerMessage: 4,
  },

  // Tautan yang diizinkan hanya untuk GIF (menu GIF Discord) dan berkas media Discord.
  gifHosts: ['tenor.com', 'giphy.com', 'cdn.discordapp.com', 'discordapp.net'],

  // ID user yang diblokir permanen (hardcode). Contoh: '123456789012345678'
  bannedUserIds: [],

  // Kata yang diblokir (huruf kecil). Tambahkan sesuai kebutuhan.
  blockedWords: [],

  texts: {
    dmOnly: '🕶️ **Anonymous Bot hanya berfungsi lewat DM**, tidak mendukung server.\nPasang ke akunmu lewat tombol di bawah, lalu buka DM dengan bot dan ketik `/start`.',
    resumedNotice: '🔄 **Bot baru saja menyala kembali.** Chat kamu **dilanjutkan**. Pesan yang dikirim selama bot mati mungkin tidak sampai, jadi ulangi bila perlu.',
    restartNotice: '🔄 **Bot sedang restart atau pemeliharaan.** Chat/antrean kamu diakhiri. Tunggu sebentar lalu ketik `/start` untuk mencari lawan bicara lagi.',
    crashNotice: '⚠️ **Bot mengalami gangguan dan akan menyala ulang.** Chat/antrean kamu diakhiri. Tunggu sebentar lalu ketik `/start` untuk mencari lagi.',
    noChat: '💤 **Belum ada chat aktif.** Kalau chat tadi terputus, kemungkinan bot baru saja restart. Ketik `/start` untuk mencari lawan bicara baru, atau `/help` untuk panduan.',
    unsupported: 'Silakan kirimkan teks pesan atau media saja.',
    noCustomEmoji: 'Emoji kustom/eksternal tidak didukung. Silakan kirimkan emoji standar biasa.',
    footer: FOOTER,

    welcome: [
      '👋 **Selamat datang di Anonymous Bot!**',
      '',
      'Ngobrol 1-1 dengan orang acak, identitas kalian **tidak** ditampilkan.',
      '',
      '**Cara pakai**',
      '1. Ketik `/start` untuk masuk antrean.',
      '2. Setelah cocok, **kirim pesan biasa di DM ini** dan bot meneruskannya.',
      '3. Tiap pesan punya tombol **Next** (cari lawan baru), **Stop** (berhenti), dan **Report** (laporkan pesan itu).',
      '',
      '**Boleh dikirim**: teks, emoji standar, stiker, GIF, foto, dan video.',
      '',
      'Baca juga `/rules` dan `/terms`.',
      '',
      `-# ${FOOTER}`,
    ].join('\n'),

    rules: [
      '📜 **Peraturan Anonymous Bot**',
      '',
      '1. Bersikap sopan. Dilarang melecehkan, mengancam, atau menghina.',
      '2. Dilarang konten SARA, ujaran kebencian, dan kekerasan.',
      '3. **Dilarang keras** konten seksual yang melibatkan anak di bawah umur. Pelanggaran dilaporkan dan diblokir permanen.',
      '4. Dilarang mengirim foto/video seksual eksplisit, kekerasan ekstrem (gore), atau konten yang tidak diminta lawan bicara.',
      '5. Dilarang membagikan data pribadi (milikmu atau orang lain), termasuk meminta identitas lawan bicara.',
      '6. Dilarang spam, iklan, penipuan, dan tautan selain GIF.',
      '7. Dilarang mencoba mengelabui bot (alt akun untuk menghindari blokir, dsb.).',
      '',
      'Merasa tidak nyaman? Tekan **Next** atau **Report** kapan saja.',
    ].join('\n'),

    terms: [
      '📄 **Syarat & Ketentuan**',
      '',
      '**1. Penggunaan.** Dengan memakai bot ini kamu menyetujui syarat ini dan [Ketentuan Layanan Discord](https://discord.com/terms), termasuk batas usia minimal Discord.',
      '**2. Anonimitas.** Bot meneruskan pesan tanpa menampilkan namamu kepada lawan bicara. Anonimitas hanya berlaku antar pengguna: moderator dapat melihat ID akun pada transkrip.',
      '**3. Data.** Agar chat tidak terputus saat bot restart, status chat yang sedang berjalan (ID akun, riwayat pesan teks, dan tautan sementara ke media) disimpan di database dan **dihapus setelah chat berakhir**. Pada saat itu, transkrip dikirim ke log moderasi dan disimpan di sana untuk keperluan keamanan. Bot sendiri tidak menyimpan berkas gambar/video.',
      '**4. Konten pengguna.** Setiap pengguna bertanggung jawab atas pesan yang dikirimnya. Pengelola bot tidak memeriksa isi chat sebelum diteruskan dan tidak bertanggung jawab atas konten pengguna lain. Konten yang melanggar dapat dilaporkan lewat tombol **Report**.',
      '**5. Sanksi.** Pelanggaran aturan dapat berujung pemblokiran permanen dari bot tanpa pemberitahuan.',
      '**6. Layanan.** Bot disediakan apa adanya tanpa jaminan selalu tersedia. Chat dapat terputus sewaktu-waktu (mis. saat pemeliharaan).',
      '**7. Perubahan.** Syarat dapat diperbarui sewaktu-waktu.',
    ].join('\n'),
  },
};
