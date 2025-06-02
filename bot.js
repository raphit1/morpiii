const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const GAME_CHANNEL_ID = '1378737038261620806';

let mainMenuMessage = null;

async function sendMainMenu(channel) {
  // Si un ancien message menu existe, delete-le
  if (mainMenuMessage) {
    try {
      await mainMenuMessage.delete();
    } catch {}
    mainMenuMessage = null;
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('pfc_start')
        .setLabel('Pierre Feuille Ciseaux')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('icefall_start')
        .setLabel('Ice Fall')
        .setStyle(ButtonStyle.Success)
    );

  mainMenuMessage = await channel.send({
    content: 'Bienvenue ! Choisis un jeu pour commencer :',
    components: [row],
  });
}

// --- PIERRE FEUILLE CISEAUX ---
function getPfcResult(userChoice) {
  const choices = ['Pierre', 'Feuille', 'Ciseaux'];
  const botChoice = choices[Math.floor(Math.random() * choices.length)];

  if (userChoice === botChoice) return { winner: 'Egalité', botChoice };
  if (
    (userChoice === 'Pierre' && botChoice === 'Ciseaux') ||
    (userChoice === 'Feuille' && botChoice === 'Pierre') ||
    (userChoice === 'Ciseaux' && botChoice === 'Feuille')
  ) return { winner: 'Joueur', botChoice };
  return { winner: 'Bot', botChoice };
}

// --- ICE FALL ---
const ICEFALL_MAX_STEPS = 10;

class IceFallGame {
  constructor(channel, userId) {
    this.channel = channel;
    this.userId = userId;
    this.step = 0;
    this.active = true;
  }

  async sendGameMessage() {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('icefall_step')
          .setLabel('Avancer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('icefall_quit')
          .setLabel('Abandonner')
          .setStyle(ButtonStyle.Danger)
      );

    const progress = '🧊'.repeat(this.step) + '❄️'.repeat(ICEFALL_MAX_STEPS - this.step);
    this.gameMessage = await this.channel.send({
      content: `Ice Fall - Progression:\n${progress}\nClique sur **Avancer** pour continuer ou **Abandonner** pour arrêter.`,
      components: [row],
    });
  }

  async advance(interaction) {
    if (!this.active) return;
    this.step++;
    // 1 chance sur 6 de tomber
    const fall = Math.random() < 1 / 6;

    if (fall) {
      this.active = false;
      await interaction.update({
        content: `💥 Tu es tombé à la glace ! Partie terminée après ${this.step} pas.`,
        components: [],
      });
      await this.endGame();
      return;
    }

    if (this.step >= ICEFALL_MAX_STEPS) {
      this.active = false;
      await interaction.update({
        content: `🎉 Bravo, tu as atteint la fin sans tomber ! Partie terminée.`,
        components: [],
      });
      await this.endGame();
      return;
    }

    // Update le message avec la progression
    const progress = '🧊'.repeat(this.step) + '❄️'.repeat(ICEFALL_MAX_STEPS - this.step);
    await interaction.update({
      content: `Ice Fall - Progression:\n${progress}\nClique sur **Avancer** pour continuer ou **Abandonner** pour arrêter.`,
      components: this.gameMessage.components,
    });
  }

  async quit(interaction) {
    this.active = false;
    await interaction.update({
      content: 'Tu as abandonné la partie Ice Fall.',
      components: [],
    });
    await this.endGame();
  }

  async endGame() {
    // Supprime le message du jeu après un délai court
    setTimeout(async () => {
      try {
        await this.gameMessage.delete();
      } catch {}
      sendMainMenu(this.channel);
    }, 2500);
  }
}

const activeIceFallGames = new Map();

client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(GAME_CHANNEL_ID);
  if (!channel) {
    console.error('Le salon de jeu est introuvable !');
    process.exit(1);
  }
  sendMainMenu(channel);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.channelId !== GAME_CHANNEL_ID) return;

  // Boutons du menu principal
  if (interaction.customId === 'pfc_start') {
    try {
      await mainMenuMessage.delete();
      mainMenuMessage = null;
    } catch {}
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('pfc_pierre').setLabel('Pierre').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pfc_feuille').setLabel('Feuille').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pfc_ciseaux').setLabel('Ciseaux').setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({
      content: 'Pierre Feuille Ciseaux ! Choisis ton coup :',
      components: [row],
      ephemeral: false,
    });
    return;
  }

  // Pierre Feuille Ciseaux choix
  if (['pfc_pierre', 'pfc_feuille', 'pfc_ciseaux'].includes(interaction.customId)) {
    const userChoice = interaction.customId.split('_')[1];
    const choicesMap = { pierre: 'Pierre', feuille: 'Feuille', ciseaux: 'Ciseaux' };
    const choice = choicesMap[userChoice];
    const result = getPfcResult(choice);

    await interaction.update({
      content: `Tu as choisi **${choice}**.\nLe bot a choisi **${result.botChoice}**.\n\n**Résultat : ${result.winner === 'Egalité' ? 'Égalité' : result.winner === 'Joueur' ? 'Tu gagnes ! 🎉' : 'Le bot gagne ! 😢'}**`,
      components: [],
    });

    setTimeout(async () => {
      try {
        await interaction.message.delete();
      } catch {}
      const channel = interaction.channel;
      sendMainMenu(channel);
    }, 3000);

    return;
  }

  // Ice Fall start
  if (interaction.customId === 'icefall_start') {
    try {
      await mainMenuMessage.delete();
      mainMenuMessage = null;
    } catch {}

    const newGame = new IceFallGame(interaction.channel, interaction.user.id);
    activeIceFallGames.set(interaction.user.id, newGame);
    await newGame.sendGameMessage();
    await interaction.deferUpdate();
    return;
  }

  // Ice Fall avancer
  if (interaction.customId === 'icefall_step') {
    const game = activeIceFallGames.get(interaction.user.id);
    if (!game) {
      await interaction.reply({ content: "Tu n'as pas de partie Ice Fall en cours.", ephemeral: true });
      return;
    }
    await game.advance(interaction);
    return;
  }

  // Ice Fall abandon
  if (interaction.customId === 'icefall_quit') {
    const game = activeIceFallGames.get(interaction.user.id);
    if (!game) {
      await interaction.reply({ content: "Tu n'as pas de partie Ice Fall en cours.", ephemeral: true });
      return;
    }
    await game.quit(interaction);
    activeIceFallGames.delete(interaction.user.id);
    return;
  }
});

client.login(process.env.TOKEN);
