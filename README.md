# Anonymous Bot Discord

Bot chat anonim 1-1 lewat **DM**. Tanpa database: konfigurasi di `config.js`, state (antrean & sesi) hanya di memori dan hilang saat restart.

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
| `/report` | Laporkan lawan bicara (transkrip `.txt` ke webhook moderator), chat diakhiri |
| `/help` · `/rules` · `/terms` | Panduan, peraturan, syarat dan ketentuan |

- Tombol **Next / Stop / Report** ada di setiap pesan. Pada pesan berisi media, tombolnya **Laporkan pesan ini**; pesan itu ditandai `>>> DILAPORKAN >>>` di berkas laporan.
- Boleh dikirim: teks, emoji standar, stiker (PNG/APNG), GIF, foto, dan video (maks 4 file, 8 MB). Stiker animasi (Lottie), emoji kustom/eksternal, file lain, dan tautan non-GIF ditolak dengan info singkat ("Silakan kirimkan teks pesan atau media saja" / "kirimkan emoji standar biasa"). Mention dinetralkan, ada rate limit.
- GIF dari menu GIF Discord (Tenor/Giphy/CDN Discord) tampil di dalam kartu V2. Bila media tautannya tidak bisa diselesaikan, bot memakai pesan klasik berisi tautan supaya tetap tampil sebagai GIF.
- Tombol Report hanya bekerja untuk pesan dari chat yang masih aktif.
- Berkas laporan memuat ≤10 pesan terakhir beserta tautan media sementara; bot tidak menyimpan berkas media. Tidak ada gerbang usia: foto/video seksual eksplisit dilarang di `/rules` dan ditangani lewat laporan.
- DM tidak butuh intent privileged. Command bisa dipakai di DM/mana saja (install **User** maupun **Server**).

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
