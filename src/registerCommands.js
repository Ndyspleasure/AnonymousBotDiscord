'use strict';
const { definitions } = require('./commands');

/**
 * Daftarkan slash command global hanya bila berbeda dari yang sudah terdaftar
 * (hemat rate limit Discord). Dipakai otomatis saat bot start.
 * @returns {Promise<'updated'|'unchanged'>}
 */
async function syncCommands(client) {
  const current = await client.application.commands.fetch();
  const same = current.size === definitions.length
    && definitions.every((d) => current.find((c) => c.name === d.name)?.equals(d, true));
  if (same) return 'unchanged';
  await client.application.commands.set(definitions);
  return 'updated';
}

module.exports = { syncCommands };
