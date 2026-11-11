# Vanillate Match (Anonymous Chat)

Bot chat anonim 1-1 lewat **DM**. Konfigurasi di `config.js`; status chat di memori dan (opsional) di PostgreSQL.

## Alur dua bot
1. **Vanillate.ID** (Social Hub) hanya jadi jembatan: menampilkan tombol link instal Vanillate Match. Tidak menyimpan apa pun.
2. **Vanillate Match** menangani seluruh chat. Discord tidak mengirim event saat bot dipasang lewat User Install, jadi tidak ada pesan otomatis saat pemasangan. Sambutan muncul saat pemain **pertama kali** memakai `/start` (atau `/next`) atau mengirim pesan di DM bot: kartu panduan + peraturan dengan tombol **Mengerti, mulai cari lawan** (sama artinya dengan `/start`), dan pemain belum dimasukkan ke antrean sebelum itu. Setelah itu panduan tetap bisa dibuka lewat `/help`, `/rules`, `/terms`.

## Cara kerja
- Semua pesan info/peringatan ke pemain ada di `src/messages.js` (angka seperti lama antrean dan batas ukuran diambil dari `config.limits`) dan `config.js` `texts`. Setiap pesan menjelaskan apa yang terjadi, apakah pemain perlu bertindak, dan pilihan berikutnya.
- **Sepi:** chat berakhir otomatis bila tidak ada pesan selama 1 hari (`limits.idleTimeoutMs`). Selama sepi, bot mengingatkan **tiap pemain di DM-nya sendiri** tiap 6 jam (`limits.idleReminderMs`; ke-1, ke-2, ke-3 di jam 6, 12, 18), dengan mention untuk pemain itu saja. Bot tidak pernah me-mention lawan bicara di DM pemain lain karena itu membuka identitasnya. Pesan baru dari siapa pun menghitung ulang waktunya. Pengingat tidak disimpan di database: setelah restart, pengingat yang sudah lewat tidak dikirim ulang. Antrean tetap habis dalam 5 menit.
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
| `/report` | Laporkan lawan bicara (transkrip `.txt` ke webhook laporan), chat diakhiri |
| `/help` · `/rules` · `/terms` | Panduan, peraturan, syarat dan ketentuan |

- Tombol **Next / Stop / Report** ada di setiap pesan. Pada pesan berisi media, tombolnya **Laporkan pesan ini**; pesan itu ditandai `>>> DILAPORKAN >>>` di berkas laporan.
- Boleh dikirim: teks (maks 1000 karakter), emoji standar, stiker (PNG/APNG/GIF), GIF, foto, dan video (maks 4 file, 8 MB). Stiker animasi (Lottie), emoji kustom/eksternal, undangan server, pesan suara dan file lain, serta tautan selain GIF (Tenor, Giphy) dan berkas media Discord ditolak dengan info bahwa pesan itu tidak diteruskan beserta alasannya. Mention dinetralkan, ada rate limit (maks 8 pesan per 10 detik).
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
Nama aplikasi, avatar, dan deskripsi bot (**Vanillate Match**) diatur di Developer Portal → General Information; itu tidak bisa diubah dari kode.

Developer Portal → Installation: aktifkan **hanya User Install** (matikan Guild Install). Link instal: `https://discord.com/oauth2/authorize?client_id=<CLIENT_ID>&integration_type=1&scope=applications.commands` (dipakai tombol di Vanillate.ID).

## Penyimpanan (PostgreSQL, opsional tapi disarankan)
Tanpa `DATABASE_URL`, bot hanya memakai memori: chat putus bila bot restart. Dengan `DATABASE_URL` (mis. Aiven PostgreSQL), status chat disimpan di tabel `anon_chats`, `anon_history`, `anon_queue` (dibuat otomatis), serta `anon_seen` (hanya ID pemain yang sudah melihat kartu sambutan, supaya tidak muncul lagi setelah restart; tanpa database kartu itu muncul sekali lagi setelah restart) dan **dipulihkan saat bot menyala**: chat dilanjutkan, pengguna diberi tahu "Bot baru saja menyala kembali", tombol Report lama tetap valid. Baris chat dihapus setelah chat berakhir dan transkrip terkirim ke log moderasi.

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
