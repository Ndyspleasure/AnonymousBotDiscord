'use strict';
const FOOTER = 'Patuhi syarat dan ketentuan kami, pelanggar dapat dikenakan sanksi banned permanen';
// Konfigurasi dan teks bot ada di sini. Status chat disimpan di memori dan (opsional) PostgreSQL, lihat src/store.js. Ubah lalu deploy ulang.
// Batas pesan dipakai bersama oleh `limits` dan teks panduan, supaya angka di teks tidak bisa basi.
const MAX_TEXT = 1000;
const MAX_MEDIA = 4;
const MAX_MEDIA_MB = 8;

// Isi panduan. Dipakai `/help` (welcome) dan kartu sambutan pemain baru (firstUse).
// Setiap klaim di sini harus sama dengan perilaku src/filter.js dan index.js (diuji di test/onboarding.test.js).
const WELCOME_BODY = [
  '👋 **Selamat datang di Vanillate Match!**',
  '',
  'Ngobrol 1-1 dengan orang acak, identitas kalian **tidak** ditampilkan.',
  '',
  '**Cara pakai**',
  '1. Ketik `/start` untuk masuk antrean.',
  '2. Setelah cocok, **kirim pesan biasa di DM ini** dan bot meneruskannya.',
  '3. Tiap pesan punya tombol **Next** (cari lawan baru), **Stop** (berhenti), dan **Report** (laporkan pesan itu).',
  '',
  `**Boleh dikirim**: teks (maks ${MAX_TEXT} karakter), emoji standar, stiker, GIF dari menu GIF Discord, foto, dan video (maks ${MAX_MEDIA} file per pesan, ${MAX_MEDIA_MB} MB per file).`,
  '**Tidak bisa dikirim**: tautan (kecuali GIF dan berkas media Discord), undangan server, emoji kustom/eksternal, stiker animasi (Lottie), pesan suara, dan file lain.',
];

const RULES_LINES = [
  '📜 **Peraturan Vanillate Match**',
  '',
  '1. Bersikap sopan. Dilarang melecehkan, mengancam, atau menghina.',
  '2. Dilarang konten SARA, ujaran kebencian, dan kekerasan.',
  '3. **Dilarang keras** konten seksual yang melibatkan anak di bawah umur. Pelanggaran dilaporkan dan diblokir permanen.',
  '4. Dilarang mengirim foto/video seksual eksplisit, kekerasan ekstrem (gore), atau konten yang tidak diminta lawan bicara.',
  '5. Dilarang membagikan data pribadi (milikmu atau orang lain), termasuk meminta identitas lawan bicara.',
  '6. Dilarang spam, iklan, penipuan, dan tautan selain GIF dan berkas media Discord.',
  '7. Dilarang mencoba mengelabui bot (alt akun untuk menghindari blokir, dsb.).',
  '',
  'Merasa tidak nyaman? Tekan **Next** atau **Report** kapan saja.'
];

const config = {
  brand: { name: 'Vanillate Match', color: 0x5865f2, hubName: 'Vanillate.ID' },

  limits: {
    queueTimeoutMs: 5 * 60 * 1000,     // keluar antrean otomatis
    idleTimeoutMs: 24 * 60 * 60 * 1000, // sesi diakhiri bila tidak ada pesan selama ini (1 hari)
    idleReminderMs: 6 * 60 * 60 * 1000, // pengingat ke tiap pemain tiap selang ini selama sepi (0 = mati); harus lebih kecil dari idleTimeoutMs
    startCooldownMs: 5 * 1000,         // jeda antar /start
    msgPerWindow: 8,                   // maks pesan ...
    msgWindowMs: 10 * 1000,            // ... per jendela waktu ini
    maxMessageLength: MAX_TEXT,
    transcriptMaxEntries: 500,         // maks pesan per chat yang disimpan di memori untuk transkrip
    maxMediaBytes: MAX_MEDIA_MB * 1024 * 1024, // maks ukuran gambar/video
    maxMediaPerMessage: MAX_MEDIA,
  },

  // Tautan yang diizinkan hanya untuk GIF (menu GIF Discord) dan berkas media Discord.
  gifHosts: ['tenor.com', 'giphy.com', 'cdn.discordapp.com', 'discordapp.net'],

  // ID user yang diblokir permanen (hardcode). Contoh: '123456789012345678'
  bannedUserIds: [],

  // Kata yang diblokir (huruf kecil). Tambahkan sesuai kebutuhan.
  blockedWords: [],

  texts: {
    dmOnly: '🕶️ **Vanillate Match hanya berfungsi lewat DM** dengan bot ini, command tidak bisa dipakai di server atau grup.\nPasang bot ke akunmu lewat tombol di bawah, lalu buka DM dengan bot dan ketik `/start`.',
    resumedNotice: '🔄 **Bot baru saja menyala kembali.** Chat kamu **dilanjutkan**. Pesan yang dikirim selama bot mati mungkin tidak sampai, jadi ulangi bila perlu.',
    restartNotice: '🔄 **Bot sedang restart atau pemeliharaan.** Chat/antrean kamu diakhiri. Tunggu sebentar lalu ketik `/start` untuk mencari lawan bicara lagi.',
    crashNotice: '⚠️ **Bot mengalami gangguan dan akan menyala ulang.** Chat/antrean kamu diakhiri. Tunggu sebentar lalu ketik `/start` untuk mencari lagi.',
    noChat: '💤 **Belum ada chat aktif.** Ketik `/start` untuk mencari lawan bicara, atau `/help` untuk panduan. Kalau chat tadi terputus, kemungkinan bot baru saja restart.',
    unsupported: '⚠️ **Pesan ini tidak diteruskan** karena jenisnya tidak didukung. Yang bisa dikirim: teks, emoji standar, stiker, GIF, foto, dan video. Ketik `/help` untuk rinciannya.',
    noCustomEmoji: '⚠️ **Pesan ini tidak diteruskan** karena memuat emoji kustom atau eksternal. Pakai emoji standar saja.',
    footer: FOOTER,

    welcome: [...WELCOME_BODY, '', 'Baca juga `/rules` dan `/terms`.', '', `-# ${FOOTER}`].join('\n'),

    rules: RULES_LINES.join('\n'),

    terms: [
      '📄 **Syarat & Ketentuan**',
      '',
      '**1. Penggunaan.** Dengan memakai bot ini kamu menyetujui syarat ini dan [Ketentuan Layanan Discord](https://discord.com/terms), termasuk batas usia minimal Discord.',
      '**2. Anonimitas.** Bot meneruskan pesan tanpa menampilkan namamu kepada lawan bicara. Anonimitas hanya berlaku antar pengguna: moderator dapat melihat ID akun pada transkrip.',
      '**3. Data.** Agar chat tidak terputus saat bot restart, status chat yang sedang berjalan (ID akun, riwayat pesan teks, dan tautan sementara ke media) disimpan di database dan **dihapus setelah chat berakhir**. Pada saat itu, transkrip dikirim ke log moderasi dan disimpan di sana untuk keperluan keamanan. Bot sendiri tidak menyimpan berkas gambar/video. Selain itu, bot mencatat ID akunmu dan waktu saat kamu pertama kali melihat panduan (agar panduan tidak ditampilkan berulang); catatan ini disimpan di database yang sama dan **tidak dihapus** setelah chat berakhir.',
      '**4. Konten pengguna.** Setiap pengguna bertanggung jawab atas pesan yang dikirimnya. Pengelola bot tidak memeriksa isi chat sebelum diteruskan dan tidak bertanggung jawab atas konten pengguna lain. Konten yang melanggar dapat dilaporkan lewat tombol **Report**.',
      '**5. Sanksi.** Pelanggaran aturan dapat berujung pemblokiran permanen dari bot tanpa pemberitahuan.',
      '**6. Layanan.** Bot disediakan apa adanya tanpa jaminan selalu tersedia. Chat dapat terputus sewaktu-waktu (mis. saat pemeliharaan).',
      '**7. Perubahan.** Syarat dapat diperbarui sewaktu-waktu.',
    ].join('\n'),
  },
};

// Kartu sambutan pemain baru: panduan + peraturan lengkap, ditampilkan sebelum pencocokan pertama
// (lihat src/onboarding.js). Menekan tombolnya sama dengan mengetik /start.
config.texts.firstUse = [
  ...WELCOME_BODY,
  '',
  ...RULES_LINES,
  '',
  'Dengan menekan tombol di bawah, kamu menyetujui peraturan di atas dan `/terms`.',
  '',
  `-# ${FOOTER}`,
].join('\n');

module.exports = config;
