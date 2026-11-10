'use strict';
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { definitions } = require('./src/commands');

(async () => {
  const { DISCORD_TOKEN, CLIENT_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID) throw new Error('DISCORD_TOKEN dan CLIENT_ID wajib diisi.');
  const rest = new REST().setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: definitions });
  console.log(`✅ ${definitions.length} command global terdaftar.`);
})().catch((e) => { console.error(e); process.exit(1); });
