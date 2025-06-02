const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');

const TOKEN = process.env.TOKEN; // Met ton token dans les variables d'env Render

// ID du salon où le bot poste ses messages de jeu
const GAME_CHANNEL_ID = '1378737038261620806';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

const choices = ['Pierre', 'Feuille', 'Ciseaux'];

let lastResultMessageId = null;

async function sendGameMenu(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pfc').setLabel('Pierre Feuille Ciseaux').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('icefall').setLabel('Ice Fall').setStyle(ButtonStyle.Danger),
  );

  await channel.send({
    content: `🎮 Choisis un jeu en cliquant sur un bouton ci-dessous !`,
    components: [row],
  });
}

// Gestion du jeu Pierre Feuille Ciseaux
async function playPFC(interaction) {
  const userChoice = interaction.customId.split('_')[1];
  if (!userChoice) return;

  // Le bot choisit au hasard
  const botChoice = choices[Math.floor(Math.random() * choices.length)];

  let result = '';
  if (userChoice === botChoice) result = 'Égalité !';
  else if (
    (userChoice === 'Pierre' && botChoice === 'Ciseaux') ||
    (userChoice === 'Feuille' && botChoice === 'Pierre') ||
    (userChoice === 'Ciseaux' && botChoice === 'Feuille')
  ) result = 'Tu as gagné ! 🎉';
  else result = 'Tu as perdu... 😞';

  await interaction.deferUpdate();

  return `🪨 Pierre / 📄 Feuille / ✂️ Ciseaux\nTu as choisi **${userChoice}**\nLe bot a choisi **${botChoice}**\n\n**${result}**`;
}

// Jeu Ice Fall (1 chance sur 6 de tomber)
async function playIceFall(interaction) {
  await interaction.deferUpdate();
  const chance = Math.floor(Math.random() * 6) + 1;
  if (chance === 1) {
    return '❄️ Oh non, tu es tombé dans la glace ! Game Over. ❄️';
  } else {
    return `✅ Tu avances sans problème (chance ${chance}/6) ! Continue comme ça...`;
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(GAME_CHANNEL_ID);
  if (!channel) {
    console.error('Salon introuvable, vérifie GAME_CHANNEL_ID');
    return;
  }

  // Envoie ou réinitialise le menu de jeu à la mise en route du bot
  channel.send('🎮 **Bienvenue dans la zone de jeux !**').then(() => {
    sendGameMenu(channel);
  });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.channel.id !== GAME_CHANNEL_ID) return;

  const channel = interaction.channel;

  // Supprime l'ancien message résultat s'il existe
  if (lastResultMessageId) {
    try {
      const oldMsg = await channel.messages.fetch(lastResultMessageId);
      if (oldMsg) await oldMsg.delete();
    } catch (e) {
      // Message introuvable, ignore
    }
    lastResultMessageId = null;
  }

  if (interaction.customId === 'pfc') {
    // Pour PFC on attend le choix du joueur dans un sous-menu

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pfc_Pierre').setLabel('Pierre 🪨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pfc_Feuille').setLabel('Feuille 📄').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pfc_Ciseaux').setLabel('Ciseaux ✂️').setStyle(ButtonStyle.Primary),
    );

    // On update le message interaction avec le choix des boutons PFC
    await interaction.update({ content: 'Choisis ta main:', components: [row] });
    return;
  }

  if (interaction.customId.startsWith('pfc_')) {
    // Joueur a choisi Pierre, Feuille ou Ciseaux
    const userChoice = interaction.customId.split('_')[1];
    const resultText = await playPFC({ ...interaction, customId: interaction.customId });

    // Affiche le résultat dans un nouveau message, puis réaffiche le menu de jeu
    const resultMsg = await channel.send(resultText);
    lastResultMessageId = resultMsg.id;

    await interaction.update({ content: 'Jeu terminé.', components: [] });

    // Après 5s on remet le menu de jeu
    setTimeout(async () => {
      try {
        await resultMsg.delete();
      } catch {}
      sendGameMenu(channel);
    }, 5000);

    return;
  }

  if (interaction.customId === 'icefall') {
    // Joueur lance Ice Fall
    const resultText = await playIceFall(interaction);

    const resultMsg = await channel.send(resultText);
    lastResultMessageId = resultMsg.id;

    await interaction.update({ content: 'Jeu terminé.', components: [] });

    setTimeout(async () => {
      try {
        await resultMsg.delete();
      } catch {}
      sendGameMenu(channel);
    }, 5000);
    return;
  }
});

client.login(TOKEN);
