const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
} = require("discord.js");

const config = require("./config.json");

const MORPION_CHANNEL_ID = config.morpionChannelId;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const morpionParties = new Map();

function afficherGrille(board) {
  return board
    .map(c => c === "X" ? "❌" : c === "O" ? "⭕" : "➖")
    .join("")
    .match(/.{1,3}/g)
    .map(row => row.split("").join(" "))
    .join("\n");
}

function checkWin(board, sym) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  return lines.some(line => line.every(i => board[i] === sym));
}

function isFull(board) {
  return board.every(c => c !== null);
}

function iaPlay(board) {
  const empties = board.map((v,i) => v === null ? i : -1).filter(i => i !== -1);
  if (!empties.length) return -1;
  return empties[Math.floor(Math.random() * empties.length)];
}

async function sendStartMessage(channel) {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("start_jv_joueur")
        .setLabel("Joueur vs Joueur")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("start_jv_ia")
        .setLabel("Joueur vs IA")
        .setStyle(ButtonStyle.Secondary),
    );
  await channel.send({
    content: "🎮 **Morpion** - Choisissez un mode pour commencer !",
    components: [row],
  });
}

client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  const channel = await client.channels.fetch(MORPION_CHANNEL_ID);
  if (channel) await sendStartMessage(channel);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== MORPION_CHANNEL_ID) return;

  if (msg.content.toLowerCase() === "!morpion") {
    if (morpionParties.has(msg.channel.id))
      return msg.reply("Une partie est déjà en cours.");
    await sendStartMessage(msg.channel);
  }

  if (msg.content.toLowerCase() === "cancel" && morpionParties.has(msg.channel.id)) {
    morpionParties.delete(msg.channel.id);
    await msg.channel.send("⛔ Partie de Morpion annulée.");
    await sendStartMessage(msg.channel);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.channelId !== MORPION_CHANNEL_ID) return;

  let partie = morpionParties.get(interaction.channelId);

  if (interaction.customId === "start_jv_joueur") {
    if (partie) return interaction.reply({content:"Une partie est déjà lancée.", ephemeral:true});
    morpionParties.set(interaction.channelId, {
      players: [interaction.user.id, null],
      board: Array(9).fill(null),
      turn: 0,
      messageId: null,
      mode: "jv_joueur",
    });
    return interaction.reply({
      content:`<@${interaction.user.id}> a lancé une partie Morpion (JvJ). Cliquez sur "Rejoindre" pour jouer.`,
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("join_jv_joueur").setLabel("Rejoindre").setStyle(ButtonStyle.Success)
      )],
    });
  }

  if (interaction.customId === "join_jv_joueur") {
    if (!partie) return interaction.reply({content:"Aucune partie à rejoindre.", ephemeral:true});
    if (partie.mode !== "jv_joueur") return interaction.reply({content:"Mode incorrect.", ephemeral:true});
    if (partie.players[1]) return interaction.reply({content:"La partie a déjà deux joueurs.", ephemeral:true});
    if (interaction.user.id === partie.players[0]) return interaction.reply({content:"Vous êtes déjà dans la partie.", ephemeral:true});
    partie.players[1] = interaction.user.id;

    const embed = new EmbedBuilder()
      .setTitle("🎮 Morpion - Joueur vs Joueur")
      .setDescription(`Tour de <@${partie.players[partie.turn]}> (${partie.turn === 0 ? "❌" : "⭕"})\n\n` + afficherGrille(partie.board))
      .setColor("#5865F2");

    const rows = [];
    for (let r = 0; r < 3; r++) {
      const row = new ActionRowBuilder();
      for (let c = 0; c < 3; c++) {
        const idx = r*3 + c;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`morpion_case_${idx}`)
            .setLabel(partie.board[idx] || " ")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(partie.board[idx] !== null)
        );
      }
      rows.push(row);
    }
    const msg = await interaction.reply({embeds: [embed], components: rows, fetchReply:true});
    partie.messageId = msg.id;
    morpionParties.set(interaction.channelId, partie);
    return;
  }

  if (interaction.customId === "start_jv_ia") {
    if (partie) return interaction.reply({content:"Une partie est déjà lancée.", ephemeral:true});
    partie = {
      players: [interaction.user.id, "IA"],
      board: Array(9).fill(null),
      turn: 0,
      messageId: null,
      mode: "jv_ia",
    };
    morpionParties.set(interaction.channelId, partie);

    const embed = new EmbedBuilder()
      .setTitle("🎮 Morpion - Joueur vs IA")
      .setDescription(`Tour de <@${interaction.user.id}> (❌)\n\n` + afficherGrille(partie.board))
      .setColor("#5865F2");

    const rows = [];
    for(let r=0; r<3; r++) {
      const row = new ActionRowBuilder();
      for(let c=0; c<3; c++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`morpion_case_${r*3+c}`)
            .setLabel(" ")
            .setStyle(ButtonStyle.Secondary)
        );
      }
      rows.push(row);
    }
    const msg = await interaction.reply({embeds:[embed], components:rows, fetchReply:true});
    partie.messageId = msg.id;
    morpionParties.set(interaction.channelId, partie);
    return;
  }

  if (interaction.customId.startsWith("morpion_case_")) {
    if (!partie) return interaction.reply({content:"Aucune partie en cours.", ephemeral:true});
    const idx = parseInt(interaction.customId.split("_")[2]);
    if (isNaN(idx) || idx < 0 || idx > 8) return interaction.reply({content:"Case invalide.", ephemeral:true});

    const currentPlayer = partie.players[partie.turn];
    if (partie.mode === "jv_joueur" && interaction.user.id !== currentPlayer) {
      return interaction.reply({content:"Ce n'est pas votre tour.", ephemeral:true});
    }

    if (partie.board[idx] !== null) {
      return interaction.reply({content:"Case déjà prise.", ephemeral:true});
    }

    partie.board[idx] = partie.turn === 0 ? "X" : "O";

    if (checkWin(partie.board, partie.board[idx])) {
      const embed = new EmbedBuilder()
        .setTitle("🎮 Morpion - Partie terminée")
        .setDescription(afficherGrille(partie.board) + `\n\n🎉 <@${interaction.user.id}> a gagné !`)
        .setColor("Green");
      await interaction.update({embeds: [embed], components: []});
      morpionParties.delete(interaction.channelId);
      const channel = interaction.channel;
      await sendStartMessage(channel);
      return;
    }

    if (isFull(partie.board)) {
      const embed = new EmbedBuilder()
        .setTitle("🎮 Morpion - Partie terminée")
        .setDescription(afficherGrille(partie.board) + "\n\nMatch nul !")
        .setColor("Orange");
      await interaction.update({embeds: [embed], components: []});
      morpionParties.delete(interaction.channelId);
      const channel = interaction.channel;
      await sendStartMessage(channel);
      return;
    }

    partie.turn = 1 - partie.turn;

    if (partie.mode === "jv_ia" && partie.turn === 1) {
      const iaMove = iaPlay(partie.board);
      if (iaMove !== -1) partie.board[iaMove] = "O";

      if (checkWin(partie.board, "O")) {
        const embed = new EmbedBuilder()
          .setTitle("🎮 Morpion - Partie terminée")
          .setDescription(afficherGrille(partie.board) + "\n\n🤖 L'IA a gagné !")
          .setColor("Red");
        await interaction.update({embeds: [embed], components: []});
        morpionParties.delete(interaction.channelId);
        const channel = interaction.channel;
        await sendStartMessage(channel);
        return;
      }

      if (isFull(partie.board)) {
        const embed = new EmbedBuilder()
          .setTitle("🎮 Morpion - Partie terminée")
          .setDescription(afficherGrille(partie.board) + "\n\nMatch nul !")
          .setColor("Orange");
        await interaction.update({embeds: [embed], components: []});
        morpionParties.delete(interaction.channelId);
        const channel = interaction.channel;
        await sendStartMessage(channel);
        return;
      }

      partie.turn = 0;
    }

    const embed = new EmbedBuilder()
      .setTitle(partie.mode === "jv_ia" ? "🎮 Morpion - Joueur vs IA" : "🎮 Morpion - Joueur vs Joueur")
      .setDescription(`Tour de <@${partie.players[partie.turn]}> (${partie.turn === 0 ? "❌" : "⭕"})\n\n` + afficherGrille(partie.board))
      .setColor("#5865F2");

    const rows = [];
    for(let r=0; r<3; r++) {
      const row = new ActionRowBuilder();
      for(let c=0; c<3; c++) {
        const i = r*3+c;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`morpion_case_${i}`)
            .setLabel(partie.board[i] || " ")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(partie.board[i] !== null)
        );
      }
      rows.push(row);
    }

    await interaction.update({embeds: [embed], components: rows});
  }
});

client.login(config.token);
