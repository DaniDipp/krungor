import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
//@ts-expect-error
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import Showdown, { Converter as MarkdownConverter } from 'showdown';
import { Router } from 'itty-router';
import { isValidRequest, PlatformAlgorithm } from 'discord-verify';
import {
	APIApplicationCommandAutocompleteInteraction,
	APIApplicationCommandInteractionDataBasicOption,
	APIChatInputApplicationCommandGuildInteraction,
	APIChatInputApplicationCommandInteraction,
	APIGuildInteraction,
	APIInteraction,
	APIInteractionResponseChannelMessageWithSource,
	APIMessageComponentButtonInteraction,
	APIModalSubmitGuildInteraction,
	APIPingInteraction,
	ApplicationCommandType,
	ComponentType,
	InteractionResponseType,
	InteractionType,
} from 'discord-api-types/v10';
import globalCommands from './global-commands';
import { sendDebugResponse } from './utils';

export interface Env {
	APP_ID: string;
	PUBLIC_KEY: string;
	TOKEN: string;
	DATA: KVNamespace;
	COMMANDS: KVNamespace;
	DOCS: KVNamespace;
	DEBUG: boolean;
}

const ASSET_MANIFEST = JSON.parse(manifestJSON);

const router = Router();
router.get('/', async (request: Request, env: Env, ctx: ExecutionContext) => {
	const markdown = await env.DOCS.get(ASSET_MANIFEST['README.md']);
	if (!markdown) return new Response('not found', { status: 404, statusText: 'not found' });

	const converter = new MarkdownConverter({ completeHTMLDocument: true, metadata: true, tables: true });
	const html = converter.makeHtml(markdown).replace('</head>', converter.getMetadata(true) + '\n</head>');
	return new Response(html, { headers: { 'Content-Type': 'text/html' } });
});
router.get('*', async (request: Request, env: Env, ctx: ExecutionContext) => {
	try {
		return getAssetFromKV(
			{
				request,
				waitUntil: ctx.waitUntil.bind(ctx),
			},
			{
				ASSET_NAMESPACE: env.DOCS,
				ASSET_MANIFEST: ASSET_MANIFEST,
			}
		);
	} catch (e) {
		const pathname = new URL(request.url).pathname;
		return new Response(`${pathname} not found`, { status: 404, statusText: 'not found' });
	}
});

router.post('/', async (request: Request, env: Env) => {
	const valid = await isValidRequest(request, env.PUBLIC_KEY, PlatformAlgorithm.Cloudflare);
	if (!valid && !request.headers.has('debug')) return new Response('Invalid request signature', { status: 401 });

	const interaction = (await request.json().catch(() => null)) as any;
	if (!interaction) return new Response('Invalid request body', { status: 400 });

	// Interaction Ping
	if (isPingInteraction(interaction)) {
		console.log(interaction);
		return new Response(JSON.stringify({ type: InteractionResponseType.Pong }), {
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	// Command interactions
	if (isChatInputApplicationCommandInteraction(interaction)) {
		if (isGuildInteraction(interaction)) {
			const response = await env.COMMANDS.get(`${interaction.guild_id}-${interaction.data.id}-${interaction.data.name}`);
			if (response) {
				console.log(JSON.stringify(interaction));
				if (env.DEBUG) {
					await sendDebugResponse(env, interaction, buildCommandResponse(env, response, interaction));
					return new Response();
				}
				return new Response(JSON.stringify(buildCommandResponse(env, response, interaction)), {
					headers: {
						'Content-Type': 'application/json',
					},
				});
			}
		}

		const command = globalCommands.find((c) => c.data.name === interaction.data.name);
		if (command) {
			const response = await globalCommands[0].commandHandler(env, interaction);
			if (env.DEBUG) {
				await sendDebugResponse(env, interaction, response);
				return new Response();
			}
			return new Response(JSON.stringify(response), {
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}

		return new Response(JSON.stringify({ type: InteractionResponseType.Pong }), {
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	// Modal submit interactions
	if (isModalSubmitGuildInteraction(interaction)) {
		const response = await globalCommands[0].modalSubmitHandler?.(env, interaction);
		if (!response) return new Response(null, { status: 404 });
		if (env.DEBUG) {
			await sendDebugResponse(env, interaction, response);
			return new Response();
		}
		return new Response(JSON.stringify(response), {
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	// Autocomplete interactions
	if (isApplicationAutocompleteInteraction(interaction)) {
		const response = await globalCommands[0].autocompleteHandler?.(env, interaction);
		if (!response) return new Response(null, { status: 404 });
		if (env.DEBUG) {
			await sendDebugResponse(env, interaction, response);
			return new Response();
		}
		return new Response(JSON.stringify(response), {
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	// Button interaction
	if (isMessageComponentButtonInteraction(interaction)) {
		const response = await globalCommands[0].buttonHandler?.(env, interaction);
		if (!response) return new Response(null, { status: 404 });
		if (env.DEBUG) {
			await sendDebugResponse(env, interaction, response);
			return new Response();
		}
		return new Response(JSON.stringify(response), {
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	return new Response(JSON.stringify({ error: `Unknown type: ${interaction.type}` }), { status: 400 });
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// env.DEBUG = true;
		return await router.handle(request, env, ctx);
	},
};

function isPingInteraction(interaction: any): interaction is APIPingInteraction {
	return interaction.type === InteractionType.Ping;
}
function isChatInputApplicationCommandInteraction(interaction: any): interaction is APIChatInputApplicationCommandInteraction {
	return interaction.type === InteractionType.ApplicationCommand && interaction.data.type === ApplicationCommandType.ChatInput;
}
function isModalSubmitGuildInteraction(interaction: any): interaction is APIModalSubmitGuildInteraction {
	return interaction.type === InteractionType.ModalSubmit && interaction.guild_id;
}
function isApplicationAutocompleteInteraction(interaction: any): interaction is APIApplicationCommandAutocompleteInteraction {
	return interaction.type === InteractionType.ApplicationCommandAutocomplete;
}
function isMessageComponentButtonInteraction(interaction: any): interaction is APIMessageComponentButtonInteraction {
	return interaction.type === InteractionType.MessageComponent && interaction.data.component_type === ComponentType.Button;
}
function isGuildInteraction(interaction: APIInteraction): interaction is APIGuildInteraction {
	return !!interaction.guild_id && !!interaction.member;
}

function buildCommandResponse(
	env: Env,
	response: string,
	interaction: APIChatInputApplicationCommandGuildInteraction
): APIInteractionResponseChannelMessageWithSource {
	console.debug(response);
	const username = interaction.member.nick ?? interaction.member.user.global_name ?? interaction.member.user.username;
	response = response.replaceAll('{sender.name}', username);

	const optionMatches = response.matchAll(/\{options.([-_\p{L}\p{N}]{1,32})\}/gu);
	for (const match of optionMatches) {
		const [option, optionName] = match;
		const optionValue = interaction.data.options?.find((o) => o.name === optionName) as APIApplicationCommandInteractionDataBasicOption;
		console.debug(option, optionName, optionValue);
		if (!optionValue) continue;
		response = response.replaceAll(option, String(optionValue.value));
	}

	console.debug(response);

	return {
		type: InteractionResponseType.ChannelMessageWithSource,
		data: {
			content: response,
		},
	};
}
