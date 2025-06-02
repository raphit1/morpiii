const { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events } = require('discord.js');

const TOKEN = process.env.TOKEN; // Tu dois configurer la variable d'environnement sur Render
const GAME_CHANNEL_ID = '1378737038261620806'; // Ton salon de jeu

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    const channel = await client.channels.fetch(GAME_CHANNEL_ID);
    if (!channel) return console.error("❌ Salon de jeu introuvable.");

    sendGameMenu(channel);
});

function sendGameMenu(channel) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('pfc')
            .setLabel('🎮 Pierre Feuille Ciseaux')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('pileouface')
            .setLabel('🪙 Pile ou Face')
            .setStyle(ButtonStyle.Secondary)
    );

    channel.send({ content: "**Choisis un jeu :**", components: [row] });
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'pfc') {
        const choices = ['🪨 Pierre', '📄 Feuille', '✂️ Ciseaux'];
        const buttons = choices.map((label, index) =>
            new ButtonBuilder()
                .setCustomId(`pfc_${index}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
            content: "Choisis ton coup :",
            components: [new ActionRowBuilder().addComponents(buttons)],
            ephemeral: true
        });
    }

    if (interaction.customId.startsWith('pfc_')) {
        const userChoiceIndex = parseInt(interaction.customId.split('_')[1]);
        const choices = ['🪨', '📄', '✂️'];
        const botChoiceIndex = Math.floor(Math.random() * 3);

        let result;
        if (userChoiceIndex === botChoiceIndex) result = "Égalité !";
        else if ((userChoiceIndex + 1) % 3 === botChoiceIndex) result = "Tu as perdu ! 😢";
        else result = "Tu as gagné ! 🎉";

        await interaction.update({
            content: `Ton choix : ${choices[userChoiceIndex]}\nMon choix : ${choices[botChoiceIndex]}\n**${result}**`,
            components: []
        });
    }

    if (interaction.customId === 'pileouface') {
        const buttons = ['🪙 Pile', '🪙 Face'].map((label, idx) =>
            new ButtonBuilder()
                .setCustomId(`pf_${idx}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            content: "Choisis pile ou face :",
            components: [new ActionRowBuilder().addComponents(buttons)],
            ephemeral: true
        });
    }

    if (interaction.customId.startsWith('pf_')) {
        const userChoice = parseInt(interaction.customId.split('_')[1]);
        const botChoice = Math.floor(Math.random() * 2);
        const options = ['Pile', 'Face'];

        const result = userChoice === botChoice ? "Bravo, tu as deviné ! 🎉" : "Dommage, perdu ! 😢";

        await interaction.update({
            content: `Ton choix : ${options[userChoice]}\nRésultat : ${options[botChoice]}\n**${result}**`,
            components: []
        });
    }
});

client.login(TOKEN);
