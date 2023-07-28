import type {
	RESTPostAPIApplicationCommandsJSONBody,
	APIApplicationCommandAutocompleteResponse,
	APIApplicationCommandAutocompleteInteraction,
	APIChatInputApplicationCommandInteraction,
	APIModalSubmitGuildInteraction,
	APIInteractionResponseChannelMessageWithSource,
	APIModalInteractionResponse,
	APIMessageComponentButtonInteraction,
} from 'discord-api-types/v10';
import type { Env } from './worker';

export type Command = {
	data: RESTPostAPIApplicationCommandsJSONBody;
	commandHandler: (
		env: Env,
		interaction: APIChatInputApplicationCommandInteraction
	) => Promise<APIInteractionResponseChannelMessageWithSource | APIModalInteractionResponse>;
	modalSubmitHandler?: (env: Env, interaction: APIModalSubmitGuildInteraction) => Promise<APIInteractionResponseChannelMessageWithSource>;
	autocompleteHandler?: (
		env: Env,
		interaction: APIApplicationCommandAutocompleteInteraction
	) => Promise<APIApplicationCommandAutocompleteResponse>;
	buttonHandler?: (
		env: Env,
		interaction: APIMessageComponentButtonInteraction
	) => Promise<APIInteractionResponseChannelMessageWithSource | APIModalInteractionResponse>;
};

import command from './commandCommand';
const commands = [command];

export default commands;
