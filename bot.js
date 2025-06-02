const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  ComponentType,
} = require('discord.js');

const TOKEN = process.env.TOKEN; // Token dans Render env vars
const GAME_CHANNEL_ID = '1378737038261620806';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

let lastResultMessageId = null;
let iceFallGames = new Map(); // userId => gameState

const PFC_CHOICES = ['Pierre', 'Feuille', 'Ciseaux'];

async function sendGameMenu(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pfc').setLabel('Pierre Feuille Ciseaux').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('icefall_start').setLabel('Ice Fall').setStyle(ButtonStyle.Danger),
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
  ) result = 'Tu as gagné ! 🎉';
  else result = 'Tu as perdu... 😞';

  return `🪨 Pierre / 📄 Feuille / ✂️ Ciseaux\nTu as choisi **${userChoice}**\nLe bot a choisi **${botChoice}**\n\n**${result}**`;
}

// --- ICE FALL ---

// Crée la grille 6x10, avec cases vides
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

// Convertit la grille en string (avec emoji)
function gridToString(grid, highlight = null) {
  // highlight = {row, col} ou null
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
  // path = [{row, col}, ...] cases parcourues
  if (i >= path.length) return;

  const grid = createGrid();
  // On colorie la case courante en rouge si chute, sinon en bleu (car on "avance")
  for (let j = 0; j < i; j++) {
    const { row, col } = path[j];
    grid[row][col] = '🟦'; // case "marchée" en bleu
  }

  // La case actuelle : rouge si chute (dernier), sinon bleu
  const current = path[i];
  if (i === path.length - 1) {
    // chute ici
    const content = gridToString(grid, current);
    await message.edit({ content });
    return;
  } else {
    // pas chute, case bleu
    grid[current.row][current.col] = '🟦';
    const content = gridToString(grid);
    await message.edit({ content });
    setTimeout(() => animateFall(channel, message, path, i + 1), 500);
  }
}

async function startIceFall(interaction) {
  // Initialisation partie IceFall

  const userId = interaction.user.id;
  if (iceFallGames.has(userId)) {
    await interaction.reply({ content: 'Tu as déjà une partie Ice Fall en cours !', ephemeral: true });
    return;
  }

  const grid = createGrid();

  // Stocke la partie, position départ = dernière ligne, colonne = à choisir par joueur
  iceFallGames.set(userId, { grid, position: { row: 9, col: null } });

  // Propose les boutons colonnes (6 colonnes)
  const row = new ActionRowBuilder();
  for (let c = 0; c < 6; c++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`icefall_col_${c}`)
        .setLabel(`${c + 1}`)
        .setStyle(ButtonStyle.Primary),
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
    // Première colonne choisie par le joueur
    game.position.col = col;
  } else if (col !== game.position.col) {
    // On ne peut changer de colonne en cours de partie
    await interaction.reply({ content: `Tu dois continuer dans la colonne ${game.position.col + 1}`, ephemeral: true });
    return;
  }

  const channel = interaction.channel;
  await interaction.deferUpdate();

  // Avance d'une case vers la gauche (en remontant la ligne)
  if (game.position.row <= 0) {
    // arrivé en haut sans tomber = victoire
    iceFallGames.delete(userId);
    await channel.send(`🎉 Bravo ${interaction.user}, tu as atteint le sommet sans tomber !`);
    sendGameMenu(channel);
    return;
  }

  // Tirage 1/6 chance de tomber
  const fallen = Math.floor(Math.random() * 6) === 0;
  const path = [];

  // Génère le chemin d'animation : de la position actuelle à la position au dessus (row-1)
  for (let r = game.position.row; r >= game.position.row - 1; r--) {
    path.push({ row: r, col: game.position.col });
  }

  const lastResultMsg = await channel.send(gridToString(game.grid));
  lastResultMessageId = lastResultMsg.id;

  if (fallen) {
    // Le joueur chute sur la case du dessus
    path[path.length - 1].fallen = true;

    // Animate la chute (dernière case rouge)
    await animateFall(channel, lastResultMsg, path);

    iceFallGames.delete(userId);
    await channel.send(`❄️ ${interaction.user} est tombé dans la glace... Partie terminée.`);
    setTimeout(() => sendGameMenu(channel), 3000);
    return;
  } else {
    // Pas de chute, on avance d'une case
    game.position.row--;

    // Met à jour la grille avec la nouvelle position (case bleue)
    game.grid[game.position.row][game.position.col] = '🟦';

    // Affiche la grille
    await lastResultMsg.edit({ content: gridToString(game.grid) });
    await channel.send(`${interaction.user} avance d'une case, continue à choisir la colonne ${game.position.col + 1}.`);

    // Sauvegarde partie et attend nouveau clic utilisateur
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
      new ButtonBuilder().setCustomId('pfc_Ciseaux').setLabel('Ciseaux ✂️').setStyle(ButtonStyle.Primary),
    );
    await interaction.update({ content: 'Choisis ta main:', components: [row] });
    return;
  }

  if (interaction.custom
