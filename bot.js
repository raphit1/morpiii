const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  Events, 
  EmbedBuilder 
} = require("discord.js");

const MORPION_CHANNEL_ID = "1378737038261620806";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// --- Variables morpion ---
const games = new Map(); // channelId -> game state

// Game state example:
// {
//   board: Array(9).fill(null), // 3x3 grid flattened
//   players: [userId1, userId2],
//   turn: 0, // index 0 or 1 for players
//   messageId: "discordMessageId",
// }

// Fonction pour dessiner le morpion en emojis
function renderBoard(board) {
  const symbols = { null: "⬜", X: "❌", O: "⭕" };
  let str = "";
  for (let i = 0; i < 9; i++) {
    str += symbols[board[i]];
    if ((i + 1) % 3 === 0) str += "\n";
  }
  return str;
}

// Vérifie si quelqu'un a gagné
function checkWinner(board) {
  const winPatterns = [
    [0,1,2],[3,4,5],[6,7,8], // lignes
    [0,3,6],[1,4,7],[2,5,8], // colonnes
    [0,4,8],[2,4,6],         // diagonales
  ];
  for (const [a,b,c] of winPatterns) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(cell => cell !== null)) return "draw";
  return null;
}

client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  const channel = await client.channels.fetch(MORPION_CHANNEL_ID);
  if (channel) {
    // Envoie un message avec les boutons de choix de jeu
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("start_morpion").setLabel("🎮 Lancer Morpion 2 joueurs").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("start_pfc").setLabel("✊ Pierre Feuille Ciseaux IA").setStyle(ButtonStyle.Secondary)
    );
    await channel.send({ content: "Choisissez votre jeu :", components: [row] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  // --- Lancer morpion ---
  if (interaction.customId === "start_morpion") {
    const channelId = interaction.channel.id;
    if (games.has(channelId)) {
      return interaction.reply({ content: "Une partie est déjà en cours ici !", ephemeral: true });
    }
    // On crée une nouvelle partie, avec le lanceur comme joueur 1, on attend joueur 2
    const game = {
      board: Array(9).fill(null),
      players: [interaction.user.id],
      turn: 0,
      messageId: null,
    };
    games.set(channelId, game);

    const row = createBoardButtons(game.board);
    await interaction.reply({ content: `<@${interaction.user.id}> a lancé une partie de Morpion ! En attente d'un 2ème joueur...`, components: [row] });

    return;
  }

  // --- Rejoindre partie morpion (joueur 2) ---
  const channelId = interaction.channel.id;
  if (games.has(channelId)) {
    const game = games.get(channelId);

    // Si bouton clique est un bouton de morpion (0-8)
    if (/^cell_\d$/.test(interaction.customId)) {
      const cellIndex = parseInt(interaction.customId.split("_")[1], 10);

      // Si pas 2 joueurs, on ajoute celui qui clique (sauf si c'est déjà joueur 1)
      if (game.players.length === 1 && !game.players.includes(interaction.user.id)) {
        game.players.push(interaction.user.id);
      }

      // Refuser si pas joueur 1 ou 2
      if (!game.players.includes(interaction.user.id)) {
        return interaction.reply({ content: "Vous ne faites pas partie de cette partie.", ephemeral: true });
      }

      // Refuser si pas à son tour
      if (game.players[game.turn] !== interaction.user.id) {
        return interaction.reply({ content: "Ce n'est pas votre tour.", ephemeral: true });
      }

      // Refuser si case déjà prise
      if (game.board[cellIndex] !== null) {
        return interaction.reply({ content: "Cette case est déjà prise.", ephemeral: true });
      }

      // Met à jour la case
      game.board[cellIndex] = game.turn === 0 ? "X" : "O";

      // Vérifie le résultat
      const winner = checkWinner(game.board);
      let content;

      if (winner === "draw") {
        content = `Match nul !\n${renderBoard(game.board)}`;
        games.delete(channelId);
      } else if (winner) {
        content = `Victoire de <@${game.players[game.turn]}> !\n${renderBoard(game.board)}`;
        games.delete(channelId);
      } else {
        // Continue la partie
        game.turn = 1 - game.turn;
        content = `C'est au tour de <@${game.players[game.turn]}> !\n${renderBoard(game.board)}`;
      }

      // Met à jour le message (ou répond)
      try {
        await interaction.update({ content, components: createBoardButtons(game.board) });
      } catch {
        await interaction.reply({ content, components: createBoardButtons(game.board), ephemeral: false });
      }
      return;
    }
  }

  // --- Pierre Feuille Ciseaux ---
  if (interaction.customId === "start_pfc") {
    const pfcRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("pierre").setLabel("🪨 Pierre").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("feuille").setLabel("📄 Feuille").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ciseaux").setLabel("✂️ Ciseaux").setStyle(ButtonStyle.Danger)
    );
    return interaction.reply({ content: "Choisissez votre coup :", components: [pfcRow], ephemeral: true });
  }

  // --- Réponse PFC ---
  const pfcChoices = ["pierre", "feuille", "ciseaux"];
  if (pfcChoices.includes(interaction.customId)) {
    const userChoice = interaction.customId;
    const botChoice = pfcChoices[Math.floor(Math.random() * pfcChoices.length)];

    let result = "🤝 Égalité !";
    if (
      (userChoice === "pierre" && botChoice === "ciseaux") ||
      (userChoice === "feuille" && botChoice === "pierre") ||
      (userChoice === "ciseaux" && botChoice === "feuille")
    ) {
      result = "🎉 Vous gagnez !";
    } else if (userChoice !== botChoice) {
      result = "😢 Vous perdez !";
    }

    return interaction.update({ content: `Vous : ${userChoice} | Bot : ${botChoice}\n${result}`, components: [] });
  }
});

// Crée les boutons du plateau de morpion selon l’état du board
function createBoardButtons(board) {
  const row1 = new ActionRowBuilder();
  const row2 = new ActionRowBuilder();
  const row3 = new ActionRowBuilder();

  const symbols = {
    null: "⬜",
    X: "❌",
    O: "⭕"
  };

  for (let i = 0; i < 9; i++) {
    const button = new ButtonBuilder()
      .setCustomId(`cell_${i}`)
      .setLabel(symbols[board[i]])
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(board[i] !== null);

    if (i < 3) row1.addComponents(button);
    else if (i < 6) row2.addComponents(button);
    else row3.addComponents(button);
  }

  return [row1, row2, row3];
}

client.login(process.env.TOKEN);
