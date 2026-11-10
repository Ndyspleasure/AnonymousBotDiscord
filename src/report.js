'use strict';

const pad = (n) => String(n).padStart(2, '0');
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
};

/** Susun isi berkas .txt laporan. Hanya teks; media tidak disertakan. */
function buildReportText({ reporterId, reportedId, buffer, now = Date.now() }) {
  const lines = [
    'LAPORAN ANONYMOUS CHAT',
    `Waktu laporan : ${stamp(now)}`,
    `Pelapor       : ${reporterId}`,
    `Terlapor      : ${reportedId}`,
    `Jumlah pesan  : ${buffer.length}`,
    '-'.repeat(40),
  ];
  if (!buffer.length) lines.push('(tidak ada pesan tercatat)');
  for (const m of buffer) {
    lines.push(`[${stamp(m.at)}] ${m.from === reporterId ? 'PELAPOR ' : 'TERLAPOR'}: ${m.text}`);
  }
  lines.push('-'.repeat(40), 'Catatan: gambar/video tidak disimpan dan tidak ikut dilaporkan.');
  return lines.join('\n');
}

/** Kirim laporan sebagai berkas .txt ke webhook moderator. true bila sukses. */
async function sendReportFile(url, args) {
  if (!url) return false;
  const text = buildReportText(args);
  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    embeds: [{
      title: '🚩 Laporan Anonymous Chat',
      description: `Pelapor: \`${args.reporterId}\`\nTerlapor: \`${args.reportedId}\`\nLampiran: transkrip teks.`,
      color: 0xed4245,
    }],
    allowed_mentions: { parse: [] },
  }));
  form.append('files[0]', new Blob([text], { type: 'text/plain' }), `laporan-${args.reportedId}-${Date.now()}.txt`);
  try {
    const r = await fetch(url, { method: 'POST', body: form });
    return r.ok;
  } catch { return false; }
}

module.exports = { buildReportText, sendReportFile };
