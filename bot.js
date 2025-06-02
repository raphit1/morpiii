const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require('discord.js');

const TOKEN = process.env.TOKEN; // Mets ton token en variable d’environnement Render
const GAME_CHANNEL_ID = '1378737038261620806'; // ID du salon de jeu

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let lastResultMessageId = null;
let iceFallGames = new Map(); // userId => gameState

const PFC_CHOICES = ['Pierre', 'Feuille', 'Ciseaux'];

async function sendGameMenu(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pfc')
      .setLabel('Pierre Feuille Ciseaux')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('icefall_start').setLabel('Ice Fall').setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `🎮 Choisis un jeu en cliquant sur un bouton ci-dessous !`,
    components: [row],
  });
}

// --- PFC ---

async function playPFC(interaction, userChoice) {
  const botChoice = PFC_CHOICES[Math.floor(Math.random() * PFC_CHOICES.length)];

  let result = '';
  if (userChoice === botChoice) result = 'Égalité !';
  else if (
    (userChoice === 'Pierre' && botChoice === 'Ciseaux') ||
    (userChoice === 'Feuille' && botChoice === 'Pierre') ||
    (userChoice === 'Ciseaux' && botChoice === 'Feuille')
  )
    result = 'Tu as gagné ! 🎉';
  else result = 'Tu as perdu... 😞';

  return `🪨 Pierre / 📄 Feuille / ✂️ Ciseaux\nTu as choisi **${userChoice}**\nLe bot a choisi **${botChoice}**\n\n**${result}**`;
}

// --- ICE FALL ---

function createGrid() {
  const rows = 10;
  const cols = 6;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push('⬜'); // Case vide blanche
    }
    grid.push(row);
  }
  return grid;
}

function gridToString(grid, highlight = null) {
  return grid
    .map((row, r) =>
      row
        .map((cell, c) => {
          if (highlight && highlight.row === r && highlight.col === c) {
            return '🟥'; // Case rouge (chute)
          }
          return cell;
        })
        .join('')
    )
    .join('\n');
}

async function animateFall(channel, message, path, i = 0) {
  if (i >= path.length) return;

  const grid = createGrid();
  for (let j = 0; j < i; j++) {
    const { row, col } = path[j];
    grid[row][col] = '🟦'; // case "marchée" en bleu
  }

  const current = path[i];
  if (i === path.length - 1) {
    // chute ici
    const content = gridToString(grid, current);
    await message.edit({ content });
    return;
  } else {
    grid[current.row][current.col] = '🟦';
    const content = gridToString(grid);
    await message.edit({ content });
    setTimeout(() => animateFall(channel, message, path, i + 1), 500);
  }
}

async function startIceFall(interaction) {
  const userId = interaction.user.id;
  if (iceFallGames.has(userId)) {
    await interaction.reply({ content: 'Tu as déjà une partie Ice Fall en cours !', ephemeral: true });
    return;
  }

  const grid = createGrid();
  iceFallGames.set(userId, { grid, position: { row: 9, col: null } });

  const row = new ActionRowBuilder();
  for (let c = 0; c < 6; c++) {
    row.addComponents(
      new ButtonBuilder().setCustomId(`icefall_col_${c}`).setLabel(`${c + 1}`).setStyle(ButtonStyle.Primary)
    );
  }

  await interaction.reply({
    content: 'Choisis la colonne où tu souhaites commencer à avancer (1 à 6) :',
    components: [row],
    ephemeral: true,
  });
}

async function handleIceFallMove(interaction) {
  const userId = interaction.user.id;
  if (!iceFallGames.has(userId)) {
    await interaction.reply({ content: 'Tu n’as pas de partie Ice Fall en cours, démarre une avec le bouton Ice Fall.', ephemeral: true });
    return;
  }

  const game = iceFallGames.get(userId);
  const col = parseInt(interaction.customId.split('_')[2], 10);

  if (game.position.col === null) {
    game.position.col = col;
  } else if (col !== game.position.col) {
    await interaction.reply({ content: `Tu dois continuer dans la colonne ${game.position.col + 1}`, ephemeral: true });
    return;
  }

  const channel = interaction.channel;
  await interaction.deferUpdate();

  if (game.position.row <= 0) {
    iceFallGames.delete(userId);
    await channel.send(`🎉 Bravo ${interaction.user}, tu as atteint le sommet sans tomber !`);
    sendGameMenu(channel);
    return;
  }

  const fallen = Math.floor(Math.random() * 6) === 0;
  const path = [];
  for (let r = game.position.row; r >= game.position.row - 1; r--) {
    path.push({ row: r, col: game.position.col });
  }

  const lastResultMsg = await channel.send(gridToString(game.grid));
  lastResultMessageId = lastResultMsg.id;

  if (fallen) {
    await animateFall(channel, lastResultMsg, path);
    iceFallGames.delete(userId);
    await channel.send(`❄️ ${interaction.user} est tombé dans la glace... Partie terminée.`);
    setTimeout(() => sendGameMenu(channel), 3000);
    return;
  } else {
    game.position.row--;
    game.grid[game.position.row][game.position.col] = '🟦';
    await lastResultMsg.edit({ content: gridToString(game.grid) });
    await channel.send(`${interaction.user} avance d'une case, continue à choisir la colonne ${game.position.col + 1}.`);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(GAME_CHANNEL_ID);
  if (!channel) {
    console.error('Salon introuvable, vérifie GAME_CHANNEL_ID');
    return;
  }

  await channel.send('🎮 **Bienvenue dans la zone de jeux !**');
  await sendGameMenu(channel);
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
    } catch (e) {}
    lastResultMessageId = null;
  }

  if (interaction.customId === 'pfc') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pfc_Pierre').setLabel('Pierre 🪨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pfc_Feuille').setLabel('Feuille 📄').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pfc_Ciseaux').setLabel('Ciseaux ✂️').setStyle(ButtonStyle.Primary)
    );
    await interaction.update({ content: 'Choisis ta main:', components: [row] });
    return;
  }

  if (interaction.customId.startsWith('pfc_')) {
    const userChoice = interaction.customId.split('_')[1];
    const result = await playPFC(interaction, userChoice);
    await interaction.update({ content: result, components: [] });
    setTimeout(() => sendGameMenu(channel), 5000);
    return;
  }

  if (interaction.customId === 'icefall_start') {
    await startIceFall(interaction);
    return;
  }

  if (interaction.customId.startsWith('icefall_col_')) {
    await handleIceFallMove(interaction);
    return;
  }
});

client.login(TOKEN);
