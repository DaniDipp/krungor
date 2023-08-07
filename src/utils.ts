import {
	APIApplicationCommand,
	RouteBases,
	Routes,
	APIInteraction,
	APIInteractionResponse,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	Snowflake,
	APIApplicationCommandOption,
	RESTPatchAPIApplicationGuildCommandJSONBody,
	ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import type { Env } from './worker';

export type GuildCommands = Record<
	Snowflake,
	{
		name: string;
		response: string;
	}
>;

export async function getCommands(env: Env, guildId: string) {
	const commands = (await env.COMMANDS.list({ prefix: guildId })).keys.map((listKey) => {
		const [guildId, commandId, commandName] = listKey.name.split('-');
		return { guildId, commandId, commandName };
	});
	if (commands.length > 900) console.warn('Approaching pagination limit!');
	return commands;
}
export async function getFullCommand(env: Env, commandKey: `${string}-${string}-${string}`) {
	const response = await env.COMMANDS.get(commandKey);
	if (!response) return null;

	const [guildId, commandId, commandName] = commandKey.split('-');

	const discordCommand = (await (
		await fetch(RouteBases.api + Routes.applicationGuildCommands(env.APP_ID, guildId) + `/${commandId}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bot ' + env.TOKEN,
			},
		})
	).json()) as APIApplicationCommand;

	const options = discordCommand.options?.map((o) => `{${o.name}:${o.description}}`);
	const syntax = `/${commandName}` + (options ? ' ' + options.join(' ') : '');

	return { guildId, id: commandId, name: commandName, syntax, description: discordCommand.description, response };
}

export async function createCommand(
	env: Env,
	guildId: string,
	command: RESTPostAPIChatInputApplicationCommandsJSONBody,
	response: string
): Promise<APIApplicationCommand> {
	const discordCommand = (await (
		await fetch(RouteBases.api + Routes.applicationGuildCommands(env.APP_ID, guildId), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bot ' + env.TOKEN,
			},
			body: JSON.stringify(command),
		})
	).json()) as APIApplicationCommand;
	await env.COMMANDS.put(`${guildId}-${discordCommand.id}-${discordCommand.name}`, response);

	return discordCommand;
}

export async function editCommand(
	env: Env,
	oldcommandKey: `${string}-${string}-${string}`,
	command: RESTPatchAPIApplicationGuildCommandJSONBody,
	response: string
) {
	const [guildId, commandId, commandName] = oldcommandKey.split('-');

	const discordCommand = (await (
		await fetch(RouteBases.api + Routes.applicationGuildCommands(env.APP_ID, guildId) + `/${commandId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bot ' + env.TOKEN,
			},
			body: JSON.stringify(command),
		})
	).json()) as APIApplicationCommand;
	const newCommandKey = `${guildId}-${commandId}-${command.name}`;
	if (oldcommandKey !== newCommandKey) await env.COMMANDS.delete(oldcommandKey);
	await env.COMMANDS.put(newCommandKey, response);
	return;
}

export async function deleteCommand(env: Env, commandKey: `${string}-${string}-${string}`) {
	const [guildId, commandId, commandName] = commandKey.split('-');

	const res = await fetch(RouteBases.api + Routes.applicationGuildCommands(env.APP_ID, guildId) + `/${commandId}`, {
		method: 'DELETE',
		headers: {
			Authorization: 'Bot ' + env.TOKEN,
		},
	});
	if (res.status === 404) return false;

	await env.COMMANDS.delete(commandKey);
	return true;
}

/**
 * Parses user-supplied command info and builds the whole command (with options) for the API call
 * @param name Command name (pre-sanitized)
 * @param description Command description (pre-sanitized)
 * @param options Command options in the format "{option1:Description 1} {option2:Description 2}"
 * @returns Object describing the command ready for the Discord API
 */
export function parseCommandInfo(name: string, description: string, options: string): RESTPostAPIChatInputApplicationCommandsJSONBody {
	const optionMatches = options.matchAll(/\{(?<name>[-_\p{L}\p{N}]{1,32}):(?<description>[^}]+)\}/gmu);
	const commandOptions: APIApplicationCommandOption[] = [...optionMatches].map((match) => ({
		type: ApplicationCommandOptionType.String,
		name: match.groups!.name,
		description: match.groups!.description,
		required: true,
	}));

	if (new Set(commandOptions.map((o) => o.name)).size !== commandOptions.length)
		throw new Error("Can't have multiple options with the same name!");

	return {
		name: name,
		description: description,
		options: commandOptions,
	};
}

export async function sendDebugResponse(env: Env, interaction: APIInteraction, response: APIInteractionResponse) {
	console.log('->', JSON.stringify(response, null, 2));
	const res = await fetch(RouteBases.api + Routes.interactionCallback(interaction.id, interaction.token), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bot ' + env.TOKEN,
		},
		body: JSON.stringify(response),
	});
	console.log('<-', res.status);
	const data = await res.json();
	console.log('<-', JSON.stringify(data, null, 2));
}

export function sendError(env: Env, e: unknown) {
	console.error(e);
	return fetch(RouteBases.api + Routes.channelMessages(env.ERROR_CHANNEL_ID), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bot ' + env.TOKEN,
		},
		body: JSON.stringify({ content: e instanceof Error ? `${e.name}: ${e.message}\n\`\`\`\n${e.stack}\n\`\`\`` : String(e) }),
	});
}
