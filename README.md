# Anonymous Bot Discord

Bot chat anonim 1-1 lewat **DM**. Konfigurasi di `config.js`; status chat di memori dan (opsional) di PostgreSQL.

## Alur dua bot
1. **Vanillate.ID** (Social Hub) hanya jadi jembatan: menampilkan tombol link instal Anonymous Bot. Tidak menyimpan apa pun.
2. **Anonymous Bot** menangani onboarding (panduan di DM) dan seluruh chat.

## Cara kerja
- `/start` → antrean → dipasangkan acak. Pesan biasa di DM bot diteruskan sebagai kartu Components V2:

```
Stranger:
<isi pesan>
[⏭️ Next] [🛑 Stop] [🚩 Report]
-# Patuhi syarat dan ketentuan kami, pelanggar dapat dikenakan sanksi banned permanen
```

| Command | Fungsi |
|---|---|
| `/start` | Masuk antrean dan dipasangkan dengan orang acak |
| `/stop` | Akhiri chat atau keluar dari antrean |
| `/next` | Akhiri chat ini dan cari lawan baru |
| `/report` | Laporkan lawan bicara |
| `/help` · `/rules` · `/terms` | Panduan, peraturan, syarat dan ketentuan |

- Tombol **Next / Stop / Report** ada di setiap pesan. Pada pesan berisi media, tombolnya **Laporkan pesan ini**; pesan itu ditandai `>>> DILAPORKAN >>>` di berkas laporan.
- Boleh dikirim: teks, emoji standar, stiker (PNG/APNG), GIF, foto, dan video (maks 4 file, 8 MB). Stiker animasi (Lottie), emoji kustom/eksternal, file lain, dan tautan non-GIF ditolak dengan info singkat ("Silakan kirimkan teks pesan atau media saja" / "kirimkan emoji standar biasa"). Mention dinetralkan, ada rate limit.
- GIF dari menu GIF Discord (Tenor/Giphy/CDN Discord) tampil di dalam kartu V2. Bila media tautannya tidak bisa diselesaikan, bot memakai pesan klasik berisi tautan supaya tetap tampil sebagai GIF.
- Tombol Report hanya bekerja untuk pesan dari chat yang masih aktif.
- **Transkrip**: setiap chat yang berakhir (Stop, Next, Report, sepi, atau lawan tak dapat dihubungi) dikirim sebagai berkas `.txt` ke `LOG_WEBHOOK_URL`; laporan ke `REPORT_WEBHOOK_URL` (cadangan: `LOG_WEBHOOK_URL`) dengan pesan yang dilaporkan ditandai. Riwayat chat disimpan di memori (maks 500 pesan) dan, bila `DATABASE_URL` diisi, di PostgreSQL selama chat berlangsung; saat bot dimatikan/restart normal (SIGTERM/SIGINT) atau crash yang tertangkap, semua pengguna yang sedang chat/antre diberi tahu dan transkrip chat yang berjalan tetap dikirim. Mati paksa (SIGKILL, kehabisan memori, listrik padam) tidak bisa ditangani: chat putus tanpa pemberitahuan dan tanpa transkrip; pesan berikutnya dari pengguna dijawab bahwa tidak ada chat aktif dan bot mungkin baru restart. Berkas memuat ID akun dan tautan media sementara; bot tidak menyimpan berkas media. Pengguna diberi tahu di `/help` dan `/terms`. Tidak ada gerbang usia: foto/video seksual eksplisit dilarang di `/rules` dan ditangani lewat laporan.
- Semua pesan bot (info, peringatan, panduan) memakai kartu Components V2, bukan embed. Balasan command dan tombol di DM tampil biasa (permanen); satu-satunya balasan ephemeral adalah arahan instal saat command dijalankan di server/grup.
- DM tidak butuh intent privileged. Bot **khusus DM** dan hanya mendukung **User Install**. Command yang dijalankan di server/grup dijawab ephemeral berisi tombol link instal User Install.

## Setup
```bash
cp .env.example .env   # isi DISCORD_TOKEN, CLIENT_ID
npm install
npm run deploy         # daftar slash command global
npm start
npm test
```
Developer Portal → Installation: aktifkan **hanya User Install** (matikan Guild Install). Link instal: `https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&integration_type=1&scope=applications.commands` (dipakai tombol di Vanillate.ID).

## Penyimpanan (PostgreSQL, opsional tapi disarankan)
Tanpa `DATABASE_URL`, bot hanya memakai memori: chat putus bila bot restart. Dengan `DATABASE_URL` (mis. Aiven PostgreSQL), status chat disimpan di tabel `anon_chats`, `anon_history`, `anon_queue` (dibuat otomatis) dan **dipulihkan saat bot menyala**: chat dilanjutkan, pengguna diberi tahu "Bot baru saja menyala kembali", tombol Report lama tetap valid. Baris chat dihapus setelah chat berakhir dan transkrip terkirim ke log moderasi.

- Memori tetap sumber utama, penulisan database berjalan di latar belakang berurutan. Bila database tidak terjangkau, bot tetap jalan (hanya memori) dan mencatat error; saat dimatikan tanpa database, pengguna diberi tahu chatnya diakhiri.
- Pesan yang dikirim **saat bot mati** tetap tidak sampai (Discord tidak mengirim ulang).
- Aiven free tier: 1 GB, `max_connections` 20 (pool bot dibatasi 4), tanpa SLA, dapat dimatikan bila lama tanpa aktivitas, region tidak bisa dipilih.
- TLS: isi `DATABASE_CA` dengan isi `ca.pem` Aiven (baris baru ditulis `\n`) untuk memverifikasi sertifikat; tanpa itu koneksi terenkripsi tetapi server tidak diautentikasi.

## Hosting
- **Wispbyte**: proses tunggal Node (`npm start`). Isi env di panel (termasuk `DATABASE_URL`).
- Hentikan/restart lewat tombol di panel (SIGTERM), bukan kill, supaya penulisan database sempat selesai.

## Batasan
- Mati paksa (kehabisan memori, kill, listrik padam): chat berhenti selama bot mati, lalu dilanjutkan setelah menyala bila database tersedia.
- Ban permanen: isi `bannedUserIds` di `config.js`.
