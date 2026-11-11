'use strict';

/**
 * Semua pesan info/peringatan yang dikirim bot ke pemain, di satu tempat.
 *
 * Aturan menulis: setiap pesan menjawab tiga hal, yaitu (1) apa yang terjadi sekarang,
 * (2) apakah pemain perlu melakukan sesuatu, (3) apa yang bisa dilakukan berikutnya. Command
 * hanya disebut sebagai pilihan, bukan sebagai langkah wajib. Angka (menit, detik, batas
 * ukuran) diambil dari config.limits supaya tidak bisa berbeda dari perilaku sebenarnya.
 */

const config = require('../config');

const L = () => config.limits;
const menit = (ms) => Math.max(1, Math.round(ms / 60000));
const detik = (ms) => Math.max(1, Math.ceil(ms / 1000));
const mb = (bytes) => Math.floor(bytes / 1048576);
/** Durasi untuk dibaca pemain: "1 hari", "6 jam", atau "30 menit". */
function lama(ms) {
  const hari = 24 * 3600_000; const jam = 3600_000;
  if (ms >= hari && ms % hari === 0) return `${ms / hari} hari`;
  if (ms >= jam && ms % jam === 0) return `${ms / jam} jam`;
  return `${menit(ms)} menit`;
}
const pengingatAktif = () => L().idleReminderMs > 0 && L().idleReminderMs < L().idleTimeoutMs;

const messages = {
  banned: '⛔ **Akunmu diblokir** dan tidak dapat memakai bot ini.',

  /** Dikirim ke KEDUA pihak begitu terhubung. */
  connected: () => [
    '✅ **Terhubung dengan orang acak!**',
    'Chat sudah dimulai, kamu tidak perlu mengetik command lagi. **Kirim saja pesan biasa di DM ini** dan bot meneruskannya ke lawan bicaramu. Pesannya tampil sebagai **Stranger**, identitas kalian tidak ditampilkan.',
    '',
    'Di bawah setiap pesan dari lawan bicaramu ada tombol **Next** (cari lawan baru), **Stop** (berhenti), dan **Report** (laporkan). Command `/next`, `/stop`, dan `/report` juga bisa dipakai kapan saja.',
    '',
    `-# Chat berakhir otomatis bila tidak ada pesan selama ${lama(L().idleTimeoutMs)}.${pengingatAktif() ? ` Selama sepi, bot mengingatkan kamu tiap ${lama(L().idleReminderMs)}.` : ''}`,
  ].join('\n'),

  queued: () => [
    '🔎 **Mencari lawan bicara…**',
    'Kamu sudah masuk antrean dan tidak perlu melakukan apa pun. Bot akan mengirim pesan di DM ini begitu ada yang cocok.',
    `Bila belum ada dalam ${menit(L().queueTimeoutMs)} menit, kamu otomatis keluar dari antrean. Mau batal sekarang? Ketik \`/stop\`.`,
  ].join('\n'),

  cooldown: () => `⏳ **Terlalu cepat.** Tunggu ${detik(L().startCooldownMs)} detik, lalu ketik \`/start\` lagi.`,

  busyInChat: '💬 **Kamu masih terhubung dengan seseorang.** Kirim pesan biasa untuk ngobrol. Pakai `/next` untuk ganti lawan atau `/stop` untuk berhenti.',
  busyInQueue: '🔎 **Kamu sudah ada di antrean.** Tunggu sampai ada lawan yang cocok, bot akan memberi tahu di DM ini. Ketik `/stop` untuk batal.',

  matchUnreachable: '❌ **Lawan yang cocok tidak bisa dihubungi** (mungkin DM-nya tertutup), jadi pencocokan dibatalkan. Ketik `/start` untuk mencari lagi.',

  stoppedChat: '🛑 **Chat diakhiri.** Ketik `/start` kapan saja untuk mencari lawan bicara baru.',
  stoppedQueue: '🛑 **Kamu keluar dari antrean.** Ketik `/start` kapan saja untuk mencari lagi.',
  stopNothing: '💤 **Kamu tidak sedang dalam chat atau antrean.** Ketik `/start` untuk mencari lawan bicara.',

  /** Untuk pihak yang ditinggalkan saat lawan memakai /stop atau /next. */
  partnerLeft: '👋 **Lawan bicaramu mengakhiri chat.** Ketik `/start` untuk mencari lawan baru.',
  /** Untuk pihak lain saat chat diakhiri lewat laporan (tidak menyebut siapa yang melapor). */
  chatEnded: '👋 **Chat diakhiri.** Ketik `/start` untuk mencari lawan baru.',

  reportNothing: '🚩 **Tidak ada chat aktif untuk dilaporkan.** `/report` hanya bisa dipakai saat kamu sedang terhubung dengan seseorang.',
  reportWrongMessage: '🚩 **Pesan ini bukan bagian dari chat yang sedang aktif**, jadi tidak bisa dilaporkan. Tombol Report hanya berlaku untuk pesan dari lawan bicaramu yang sekarang.',
  reportSent: '🚩 **Laporan terkirim ke moderator** (berisi transkrip chat ini) dan chat diakhiri. Terima kasih sudah melapor. Ketik `/start` bila ingin mencari lawan baru.',
  reportNotSent: '🚩 **Chat diakhiri, tetapi laporan belum bisa dikirim ke moderator** (kanal laporan belum diatur pemilik bot atau sedang bermasalah). Ketik `/start` bila ingin mencari lawan baru.',

  /** Peringatan di DM. Semuanya berarti pesan itu TIDAK diteruskan. */
  empty: '⚠️ **Pesan kosong tidak diteruskan.** Kirim teks, foto, video, GIF, atau stiker.',
  tooFast: () => `⚠️ **Terlalu cepat, pesan ini tidak diteruskan.** Maksimal ${L().msgPerWindow} pesan per ${detik(L().msgWindowMs)} detik. Coba lagi sebentar lagi.`,
  tooManyFiles: () => `⚠️ **Pesan ini tidak diteruskan.** Maksimal ${L().maxMediaPerMessage} file per pesan.`,
  fileTooBig: () => `⚠️ **Pesan ini tidak diteruskan.** Ukuran maksimal ${mb(L().maxMediaBytes)} MB per file.`,
  unsupported: () => config.texts.unsupported,
  customEmoji: () => config.texts.noCustomEmoji,
  tooLong: () => `⚠️ **Pesan ini tidak diteruskan** karena terlalu panjang. Maksimal ${L().maxMessageLength} karakter, persingkat lalu kirim lagi.`,
  blockedWord: '⚠️ **Pesan ini tidak diteruskan** karena mengandung kata yang diblokir.',
  relayUnreachable: '❌ **Pesanmu tidak sampai** karena lawan bicara tidak dapat dihubungi (mungkin DM-nya tertutup). Chat diakhiri. Ketik `/start` untuk mencari lawan baru.',

  /**
   * Pengingat sepi, dikirim ke TIAP pemain di DM-nya sendiri dengan mention untuk pemain itu saja.
   * Tidak boleh me-mention lawan bicara (membuka identitas) dan tidak menyebut siapa yang diam.
   * @param {string} userId penerima  @param {number} count pengingat ke-berapa (1, 2, ...)
   */
  idleReminder: (userId, count) => {
    const sepi = count * L().idleReminderMs;
    return [
      `<@${userId}> 💬 **Chatmu masih terbuka, tetapi belum ada pesan selama ${lama(sepi)}.**`,
      'Kalau kamu atau lawan bicaramu masih ingin lanjut, kirim saja pesan biasa kapan pun, tidak perlu command. Pesan itu otomatis menghitung ulang waktunya.',
      `Chat akan berakhir otomatis bila tidak ada pesan sampai ${lama(L().idleTimeoutMs)} (sekitar ${lama(L().idleTimeoutMs - sepi)} lagi). Mau berhenti sekarang? Ketik \`/stop\`.`,
    ].join('\n');
  },

  /** Dikirim otomatis oleh penjadwal. */
  queueExpired: '⌛ **Belum ada lawan bicara yang cocok**, jadi kamu dikeluarkan dari antrean. Ketik `/start` untuk mencoba lagi.',
  idleEnded: () => `💤 **Chat berakhir otomatis** karena tidak ada pesan selama ${lama(L().idleTimeoutMs)}. Ketik \`/start\` untuk mencari lawan baru.`,
};

/** Ambil pesan; fungsi dipanggil agar angkanya selalu mengikuti config saat ini. */
function msg(key, ...args) {
  const v = messages[key];
  if (v === undefined) throw new Error(`pesan tidak dikenal: ${key}`);
  return typeof v === 'function' ? v(...args) : v;
}

module.exports = { msg, messages };
