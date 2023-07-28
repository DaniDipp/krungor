import {
	PermissionFlagsBits,
	RESTPostAPIApplicationCommandsJSONBody,
	ApplicationCommandOptionType,
	InteractionResponseType,
	APIApplicationCommandAutocompleteResponse,
	APIApplicationCommandAutocompleteInteraction,
	ApplicationCommandType,
	APIChatInputApplicationCommandInteraction,
	APIApplicationCommandInteractionDataStringOption,
	APIModalSubmitGuildInteraction,
	APIInteractionResponseChannelMessageWithSource,
	APIInteractionResponseCallbackData,
	APIModalInteractionResponse,
	APIModalInteractionResponseCallbackData,
	ComponentType,
	TextInputStyle,
	APIMessageComponent,
	APIMessageActionRowComponent,
	APIActionRowComponent,
	ButtonStyle,
	APICommandAutocompleteInteractionResponseCallbackData,
	APIApplicationCommandOptionChoice,
	APIMessageComponentButtonInteraction,
} from 'discord-api-types/v10';
import type { Env } from './worker';
import type { Command } from './global-commands';
import { createCommand, deleteCommand, getFullCommand, getCommands, parseCommandInfo, editCommand } from './utils';

const command: Command = {
	data: {
		name: 'command',
		description: 'Manage custom commands',
		default_member_permissions: String(PermissionFlagsBits.ManageGuild),
		dm_permission: false,
		options: [
			{
				name: 'create',
				description: 'Create a new command',
				type: ApplicationCommandOptionType.Subcommand,
			},
			{
				name: 'edit',
				description: 'edit an existing command',
				type: ApplicationCommandOptionType.Subcommand,
				options: [
					{
						name: 'command_name',
						description: 'Name of the command to edit',
						type: ApplicationCommandOptionType.String,
						required: true,
						autocomplete: true,
					},
				],
			},
			{
				name: 'delete',
				description: 'Delete a command',
				type: ApplicationCommandOptionType.Subcommand,
				options: [
					{
						name: 'command_name',
						description: 'Name of the command to delete',
						type: ApplicationCommandOptionType.String,
						required: true,
						autocomplete: true,
					},
				],
			},
		],
	},
	commandHandler: async (env, interaction) => {
		console.log(JSON.stringify(interaction));
		if (!interaction.guild_id) return buildMessage('🛑 Only usable in guilds');
		if (interaction.data.type !== ApplicationCommandType.ChatInput) return buildMessage('🛑 Invalid interaction type');
		if (!interaction.data.options || interaction.data.options.length === 0) return buildMessage('🛑 Malformed interaction');
		const subcommand = interaction.data.options[0];
		if (!subcommand || subcommand.type !== ApplicationCommandOptionType.Subcommand) return buildMessage('🛑 Malformed subcommand');

		if (subcommand.name === 'create') {
			const commands = await getCommands(env, interaction.guild_id);
			if (commands.length >= 100)
				return buildMessage('🛑 This server is at the limit of 100 commands. Please delete one before creating another one.');
			return buildModal(commandCreateModal(`command-create-new`));
		}

		if (subcommand.name === 'edit') {
			if (!subcommand.options || subcommand.options.length === 0) return buildMessage('🛑 Malformed subcommand options');
			const commandKey = subcommand.options.find((o) => o.name === 'command_name') as APIApplicationCommandInteractionDataStringOption;
			if (!commandKey) return buildMessage('🛑 Missing command');
			if (commandKey.value.match(/-/g)?.length !== 2) return buildMessage("🛑 Couldn't parse command");

			const fullCommand = await getFullCommand(env, commandKey.value as `${string}-${string}-${string}`);
			if (!fullCommand) return buildMessage('🛑 Command not found in DB');

			return buildModal(commandCreateModal(`command-edit-${fullCommand.id}`, fullCommand));
		}

		if (subcommand.name === 'delete') {
			if (!subcommand.options || subcommand.options.length === 0) return buildMessage('🛑 Malformed subcommand options');
			const commandKey = subcommand.options.find((o) => o.name === 'command_name') as APIApplicationCommandInteractionDataStringOption;
			if (!commandKey) return buildMessage('🛑 Missing command');
			if (commandKey.value.match(/-/g)?.length !== 2) return buildMessage("🛑 Couldn't parse command");

			const [guildId, commandId, commandName] = commandKey.value.split('-');
			const deleted = await deleteCommand(env, commandKey.value as `${string}-${string}-${string}`);
			if (!deleted) return buildMessage(`🛑 The command </${commandName}:${commandId}> doesn't exist.`);
			return buildMessage(`✅ The command </${commandName}:${commandId}> has been deleted.`);
		}

		return buildMessage(`🛑 Unknown subcommand "${subcommand.name}"`);
	},
	autocompleteHandler: async (env, interaction) => {
		console.log(JSON.stringify(interaction));
		if (!interaction.guild_id) return buildAutocomplete(null);
		const subCommandData = interaction.data.options[0];
		if (
			subCommandData.type !== ApplicationCommandOptionType.Subcommand ||
			!['edit', 'delete'].includes(subCommandData.name) ||
			!subCommandData.options
		)
			return buildAutocomplete(null);
		const commandSearch = subCommandData.options.find((o) => o.name === 'command_name');
		if (!commandSearch || commandSearch.type !== ApplicationCommandOptionType.String) return buildAutocomplete(null);
		let commandName = commandSearch.value.toLowerCase().replace(/^\/+/, '');

		const commands = (await getCommands(env, interaction.guild_id)).filter((c) => c.commandName.startsWith(commandName));
		return buildAutocomplete(
			commands.map((c) => ({ name: c.commandName, value: `${interaction.guild_id}-${c.commandId}-${c.commandName}` }))
		);
	},
	modalSubmitHandler: async (env, interaction) => {
		console.log(JSON.stringify(interaction));
		const commands = await getCommands(env, interaction.guild_id);
		if (commands.length >= 100)
			return buildMessage('🛑 This server is at the limit of 100 commands. Please delete one before creating another one.');
		let syntax = interaction.data.components.find((c) => c.components[0].custom_id === 'command-syntax')?.components[0].value;
		const description = interaction.data.components.find((c) => c.components[0].custom_id === 'command-description')?.components[0].value;
		const response = interaction.data.components.find((c) => c.components[0].custom_id === 'command-response')?.components[0].value;
		if (!syntax || !description || !response) return buildMessage('🛑 Command name, description, and response are required');

		syntax = syntax.toLowerCase();
		if (syntax.startsWith('/')) syntax = syntax.substring(1);

		const [commandName, ...options] = syntax.split(' ');
		const commandOptions = options.join(' ');

		if (!/^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u.test(commandName))
			return buildMessage(`🛑 The command name \`${commandName}\` is invalid.`);

		const [_, action, commandId] = interaction.data.custom_id.split('-');
		if (action === 'create') {
			const existingCommand = commands.find((c) => c.commandName === commandName);
			if (existingCommand)
				return buildMessage(
					`🛑 A command with the same name already exists: </${existingCommand.commandName}:${existingCommand.commandId}>`,
					[
						{
							type: ComponentType.Button,
							custom_id: `command-edit-${existingCommand.commandId}`,
							style: ButtonStyle.Primary,
							label: 'Edit that one',
						},
						// {
						// 	type: ComponentType.Button,
						// 	custom_id: `command-overwrite-${interaction.data.custom_id}`,
						// 	style: ButtonStyle.Danger,
						// 	label: 'Overwrite',
						// },
						// {
						// 	type: ComponentType.Button,
						// 	custom_id: `command-cancel-${interaction.data.custom_id}`,
						// 	style: ButtonStyle.Primary,
						// 	label: 'Cancel',
						// },
					]
				);
			try {
				const { id } = await createCommand(env, interaction.guild_id, parseCommandInfo(commandName, description, commandOptions), response);
				return buildMessage(`✅ The command </${commandName}:${id}> has been created.`);
			} catch (e) {
				return buildMessage('🛑 ' + (e as Error).message);
			}
		}
		if (action === 'edit') {
			const existingCommand = commands.find((c) => c.commandId === commandId);
			if (!existingCommand) return buildMessage("🛑 Can't find command to edit.");
			try {
				await editCommand(
					env,
					`${existingCommand.guildId}-${existingCommand.commandId}-${existingCommand.commandName}`,
					parseCommandInfo(commandName, description, commandOptions),
					response
				);
				return buildMessage(`✅ The command </${commandName}:${existingCommand.commandId}> has been edited.`);
			} catch (e) {
				return buildMessage('🛑 ' + (e as Error).message);
			}
		}
		return buildMessage('🛑 Unknown modal');
	},
	buttonHandler: async (env, interaction) => {
		console.log(JSON.stringify(interaction));
		if (!interaction.guild_id) return buildMessage('🛑 Only usable in guilds');
		const [_, action, commandId] = interaction.data.custom_id.split('-');
		if (action === 'edit') {
			const commandKey = (await env.COMMANDS.list({ prefix: `${interaction.guild_id}-${commandId}-` })).keys.at(0);
			if (!commandKey) return buildMessage('🛑 Command not found in DB');
			const fullCommand = await getFullCommand(env, commandKey.name as `${string}-${string}-${string}`);
			if (!fullCommand) return buildMessage('🛑 Command not found in DB');

			return buildModal(commandCreateModal(`command-edit-${fullCommand.id}`, fullCommand));
		}
		// if (action === 'overwrite') {
		// }
		// if (action === 'cancel') {
		// 	return buildMessage('Command creation cancelled.');
		// }
		return buildMessage('🛑 Unknown button');
	},
};

export default command;

function buildMessage(
	data: string | APIInteractionResponseCallbackData,
	components?: APIMessageActionRowComponent | APIMessageActionRowComponent[]
): APIInteractionResponseChannelMessageWithSource {
	data = typeof data === 'string' ? { content: data } : data;
	if (components) {
		if (!Array.isArray(components)) components = [components];
		data.components = [
			{
				type: ComponentType.ActionRow,
				components,
			},
		];
	}
	return {
		type: InteractionResponseType.ChannelMessageWithSource,
		data,
	};
}

function buildAutocomplete(choices: APIApplicationCommandOptionChoice[] | null): APIApplicationCommandAutocompleteResponse {
	return {
		type: InteractionResponseType.ApplicationCommandAutocompleteResult,
		data: { choices: choices || undefined },
	};
}

function buildModal(data: APIModalInteractionResponseCallbackData): APIModalInteractionResponse {
	return {
		type: InteractionResponseType.Modal,
		data,
	};
}

function commandCreateModal(
	id: string,
	values?: { syntax: string; description: string; response: string }
): APIModalInteractionResponseCallbackData {
	return {
		custom_id: id,
		title: 'Create New Command',
		components: [
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.TextInput,
						custom_id: 'command-syntax',
						required: true,
						label: 'Command',
						style: TextInputStyle.Paragraph,
						min_length: 1,
						max_length: 250,
						placeholder: '/compliment {target:Target of the compliment} {compliment:Something nice to say about them}',
						value: values?.syntax,
					},
				],
			},
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.TextInput,
						custom_id: 'command-description',
						required: true,
						label: 'Description',
						style: TextInputStyle.Short,
						placeholder: 'Compliment something about someone else',
						min_length: 1,
						max_length: 100,
						value: values?.description,
					},
				],
			},
			{
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.TextInput,
						custom_id: 'command-response',
						required: true,
						label: 'Response',
						style: TextInputStyle.Paragraph,
						placeholder: '{sender.name} has complimented {options.target}:\n"{options.compliment}"',
						min_length: 1,
						max_length: 2000,
						value: values?.response,
					},
				],
			},
		],
	};
}
