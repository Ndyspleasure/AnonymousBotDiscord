# Anonymous Bot Discord

Bot chat anonim 1-1 lewat **DM**. Tanpa database: konfigurasi di `config.js`, state (antrean & sesi) hanya di memori dan hilang saat restart.

## Alur dua bot
1. **Vanillate.ID** (Social Hub) hanya jadi jembatan: menampilkan tombol link instal Anonymous Bot. Tidak menyimpan apa pun.
2. **Anonymous Bot** menangani onboarding (panduan di DM) dan seluruh chat.

## Cara kerja
- `/start` → antrean → dipasangkan acak. Pesan biasa di DM bot diteruskan sebagai `💬 Stranger: …`.

| Command | Fungsi |
|---|---|
| `/start` | Masuk antrean dan dipasangkan dengan orang acak |
| `/stop` | Akhiri chat atau keluar dari antrean |
| `/next` | Akhiri chat ini dan cari lawan baru |
| `/report` | Laporkan lawan bicara (transkrip `.txt` ke webhook moderator), chat diakhiri |
| `/help` | Panduan penggunaan |
| `/rules` | Peraturan |
| `/terms` | Syarat dan ketentuan |
| `/dewasa aktif:True/False` | Mode 18+ untuk gambar dan video |
- Command bisa dipakai di DM/mana saja (install **User** maupun **Server**).
- DM tidak butuh intent privileged. Teks, emoji, stiker, dan GIF (Tenor/Giphy) langsung diteruskan; tautan lain dan mention dinetralkan; ada rate limit.
- **Gambar & video** hanya bila kedua pihak menjalankan `/dewasa aktif:True` (menyatakan 18+). Penerima melihat peringatan dan harus menekan **Tampilkan**. Mode 18+ dan media tertunda dihapus saat chat berakhir. Media tidak disimpan dan tidak ikut laporan.
- `/report` mengirim ≤10 pesan terakhir sebagai berkas `.txt` ke `REPORT_WEBHOOK_URL` (opsional) lalu dibuang.

## Setup
```bash
cp .env.example .env   # isi DISCORD_TOKEN, CLIENT_ID
npm install
npm run deploy         # daftar slash command global
npm start
npm test
```
Developer Portal → Installation: aktifkan **User Install** dan **Guild Install**; link invite = Install Link Discord Provided (dipakai tombol di Vanillate.ID).

## Hosting
- **Wispbyte**: proses tunggal Node (`npm start`), cocok karena state di memori. Isi env di panel.
- **Aiven**: tidak diperlukan. Hanya relevan bila nanti ingin multi-instance (Valkey untuk antrean bersama) atau ban list dinamis (Postgres) — keduanya melanggar prinsip "tanpa penyimpanan", jadi ditunda.

## Batasan
- Restart = semua chat/antrean putus (bot memberi tahu bila sesi kedaluwarsa, tidak bila crash).
- Ban permanen: isi `bannedUserIds` di `config.js`.
