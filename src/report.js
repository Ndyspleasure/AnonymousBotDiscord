'use strict';

const pad = (n) => String(n).padStart(2, '0');
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
};

const REASONS = { ended: 'Chat diakhiri pengguna', idle: 'Chat berakhir karena sepi', report: 'Dilaporkan pengguna', unreachable: 'Lawan bicara tidak dapat dihubungi', restart: 'Bot dimatikan/restart', crash: 'Bot mengalami gangguan' };

/**
 * Susun isi berkas .txt transkrip. Media hanya berupa tautan sementara (bot tidak menyimpan berkas).
 * @param {{users:string[], startedAt:number, endedAt:number, history:object[], reason?:string, reporterId?:string, flaggedId?:number}} info
 */
function buildTranscript({ users, startedAt, endedAt, history, reason = 'ended', reporterId = null, flaggedId = null }) {
  const label = (id) => (id === users[0] ? 'USER A' : 'USER B') + (id === reporterId ? ' (PELAPOR)' : '');
  const lines = [
    reporterId ? 'LAPORAN ANONYMOUS CHAT' : 'TRANSKRIP ANONYMOUS CHAT',
    `Mulai   : ${stamp(startedAt)}`,
    `Selesai : ${stamp(endedAt)}`,
    `Alasan  : ${REASONS[reason] || reason}`,
    `USER A  : ${users[0]}`,
    `USER B  : ${users[1]}`,
    ...(reporterId ? [`Pelapor : ${reporterId}`] : []),
    `Pesan   : ${history.length}`,
    '-'.repeat(40),
  ];
  if (!history.length) lines.push('(tidak ada pesan tercatat)');
  for (const m of history) {
    const flag = flaggedId != null && m.id === flaggedId ? '>>> DILAPORKAN >>> ' : '';
    lines.push(`${flag}[${stamp(m.at)}] ${label(m.from)}: ${m.text || '(tanpa teks)'}`);
    for (const f of m.media || []) lines.push(`    media: ${f.name} ${f.url}`);
  }
  lines.push('-'.repeat(40), 'Catatan: bot tidak menyimpan gambar/video.');
  return lines.join('\n');
}

/** Kirim transkrip/laporan sebagai berkas .txt ke webhook. true bila sukses. */
async function sendTranscriptFile(url, info) {
  if (!url) return false;
  const reported = Boolean(info.reporterId);
  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    embeds: [{
      title: reported ? '🚩 Laporan Anonymous Chat' : '📝 Transkrip Anonymous Chat',
      description: `USER A: \`${info.users[0]}\`\nUSER B: \`${info.users[1]}\`\nPesan: ${info.history.length}\nAlasan: ${REASONS[info.reason] || info.reason}${reported ? `\nPelapor: \`${info.reporterId}\`` : ''}`,
      color: reported ? 0xed4245 : 0x5865f2,
    }],
    allowed_mentions: { parse: [] },
  }));
  form.append('files[0]', new Blob([buildTranscript(info)], { type: 'text/plain' }), `${reported ? 'laporan' : 'transkrip'}-${info.endedAt}.txt`);
  try {
    const r = await fetch(url, { method: 'POST', body: form });
    return r.ok;
  } catch { return false; }
}

module.exports = { buildTranscript, sendTranscriptFile };
