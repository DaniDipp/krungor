#! node_modules/.bin/ts-node-esm
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { config } from 'dotenv';
config({ path: '.dev.vars' });

import commands from './src/global-commands';

if (!process.env.APP_ID || !process.env.TOKEN) throw new Error('Env variables not defined!');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
rest.put(Routes.applicationCommands(process.env.APP_ID), { body: commands.map((c) => c.data) });
