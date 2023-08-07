---
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta property="og:type" content="website" />
<meta property="og:url" content="https://krungor.danidipp.com/" />
<meta property="og:title" content="krungor" />
<meta property="og:description" content="simple, custom commands for your server" />
<meta property="og:image" content="https://krungor.danidipp.com/krungor.png" />
<meta name="theme-color" content="#E53B33" />
<link rel="icon" type="image/png" href="krungor.png" />
<link rel="stylesheet" href="styles.css">
<title>krungor</title>
---

# krungor
krungor is a Discord bot that helps you set up simple command/response interactions for faq's, roleplay, or memes!

krungor is [open source](https://github.com/danidipp/krungor)!

## setup
1. add krungor to your server: [link](https://discord.com/api/oauth2/authorize?client_id=1132619138662141982&permissions=0&scope=bot%20applications.commands)
2. use the `/command create` command to create a new command (you need to have the Manage Server permission for this)
3. have fun!

## syntax
krungor supports some special syntax to allow you to create command options and dynamic responses.

there are some things you have to keep in mind when creating commands:
- command names can not have spaces and only `-` and `_` are allowed as special characters
- command names can be up to 32 characters long
- options are specified like this: `{option_name:Fancy description for cool option!}`
- option names have the same limits as command names
- each option must have a description (everything after the colon)

if your command has options, you can use those options in the response with `{options.option_name}`. the whole bracket will be replaced by whatever the user put in the option.

there are also other options available:
| option          | description                                              | example  |
|-----------------|----------------------------------------------------------|----------|
| `{sender.name}` | nickname or display name of the user sending the command | DaniDipp |

additional options might be added in the future!

![new command](new-command.png)

## usage
when users want to use a command, they start typing `/` followed by it's name. Discord will suggest matching ones.

![use command](use-command.png)<br>
![use options](use-options.png)

after seding the command, the variables in the response template have been replaced with the user's options!

![view command](view-command.png)

## permissions
by default, the `/command <create|edit|delete>` command is only visible to members with the Manage Server permission.
all other commands are visible and usable by everyone.

to change the settings of a krungor command, go into your Server Settings -> Integrations -> krungor

in krungor's settings, you can **click on a command** to change
- who has access to the command
- in which channels the command can be used

![permission overrides](permission-overrides.png)

## feedback
if you would like to send me feedback or suggestions, please join [krungor's support server](https://discord.gg/ThG7vZq3ZX) or create an issue on [GitHub](https://github.com/DaniDipp/krungor).

## terms of service
by using krungor, you agree to the following terms of service:
- krungor is provided as-is, and is not guaranteed to be available at all times.
- you are responsible for the commands you create, and the content they provide.
- krungor may be updated at any time, and may change or remove features without notice.
- krungor may be shut down at any time, and may be shut down permanently without notice.
- you will not use krungor to make other people upset.

## privacy policy
when you create a command, krungor **collects and stores** the following data:
- the id if your server
- the ids, names, and replys of your commands
when you delete a command, all data about it **is deleted** as well.

when a command is used, krungor **collects and processes** the following data **without storing it**:
- the id of your server
- the id of the command used
- the display name of the user who used the command
- this list might be updated with more data in the future to support additional features

krungor does not collect or store any other data or usage logs.

krungor uses Cloudflare Workers to host this website, and Cloudflare may collect additional data. you can read their privacy policy [here](https://www.cloudflare.com/privacypolicy/).

when krungors commands are used, Discord sends krungor the relevant data via Cloudflare, so Cloudflare is technically able to read it. however, they promise not to.

krungor does not use any analytics or tracking software.