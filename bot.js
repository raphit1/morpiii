const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require("discord.js");
require("dotenv").config();

const ICE_FALL_CHANNEL_ID = "1378737038261620806"; // Change selon ton serveur

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ==== PIERRE FEUILLE CISEAUX ====

const pfcGames = new Map(); // channelId => { player1Id, player2Id, player1Choice, player2Choice, messageId }

const choices = ["Pierre", "Feuille", "Ciseaux"];

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 0; // Egalité
  if (
    (choice1 === "Pierre" && choice2 === "Ciseaux") ||
    (choice1 === "Feuille" && choice2 === "Pierre") ||
    (choice1 === "Ciseaux" && choice2 === "Feuille")
  ) return 1; // Player1 gagne
  return 2; // Player2 gagne
}

// ==== ICE FALL ====

const iceFallStates = new Map(); // userId => { steps, lastMessageId }

const MAX_STEPS = 10;

function getIceFallEmbed(steps) {
  const remaining = MAX_STEPS - steps;
  return new EmbedBuilder()
    .setTitle("❄️ Ice Fall")
    .setDescription(`Vous avez fait **${steps}** pas.\nIl vous reste **${remaining}** pas avant la fin.\n\nChaque pas a 1 chance sur 6 de faire tomber la glace !\nAppuyez sur "Faire un pas" pour avancer ou "Reset" pour recommencer.`)
    .setColor(0x00bfff);
}

const iceFallButtons = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ice_step").setLabel("Faire un pas").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ice_reset").setLabel("Reset").setStyle(ButtonStyle.Danger)
  );

// ==== BOT READY ====

client.once("ready", () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
});

// ==== MESSAGE CREATE ====

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Commande PFC (Pierre-Feuille-Ciseaux)
  if (content === "!pfc") {
    if (pfcGames.has(message.channel.id)) {
      return message.reply("Une partie de Pierre-Feuille-Ciseaux est déjà en cours dans ce salon !");
    }
    // Attente d'un second joueur
    pfcGames.set(message.channel.id, { player1Id: message.author.id, player2Id: null, player1Choice: null, player2Choice: null, messageId: null });
    return message.channel.send(`🎮 ${message.author} a démarré une partie de Pierre-Feuille-Ciseaux ! Quelqu'un veut jouer avec lui ? Tapez \`!join\` pour participer.`);
  }

  // Rejoindre la partie PFC
  if (content === "!join") {
    const game = pfcGames.get(message.channel.id);
    if (!game) return; // Pas de partie en cours
    if (game.player2Id) return message.reply("La partie a déjà 2 joueurs.");
    if (message.author.id === game.player1Id) return message.reply("Vous êtes déjà dans la partie.");

    game.player2Id = message.author.id;
    // On envoie les boutons pour les choix des 2 joueurs
    const row = new ActionRowBuilder().addComponents(
      ...choices.map((choice) =>
        new ButtonBuilder()
          .setCustomId(`pfc_${choice.toLowerCase()}`)
          .setLabel(choice)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const msg = await message.channel.send({
      content: `🎮 Partie démarrée entre <@${game.player1Id}> et <@${game.player2Id}> !\nChaque joueur, choisissez votre coup en cliquant sur un bouton.`,
      components: [row],
    });

    game.messageId = msg.id;
    pfcGames.set(message.channel.id, game);
    return;
  }

  // Commande Ice Fall
  if (content === "!icefall") {
    const embed = getIceFallEmbed(0);
    const msg = await message.channel.send({ embeds: [embed], components: [iceFallButtons()] });
    iceFallStates.set(message.author.id, { steps: 0, lastMessageId: msg.id });
    return;
  }
});

// ==== INTERACTION CREATE ====

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, user, channel } = interaction;

  // Gestion Pierre-Feuille-Ciseaux
  if (customId.startsWith("pfc_")) {
    const choice = customId.slice(4).charAt(0).toUpperCase() + customId.slice(5);
    const game = pfcGames.get(channel.id);
    if (!game) return interaction.reply({ content: "Aucune partie en cours ici.", ephemeral: true });

    if (user.id !== game.player1Id && user.id !== game.player2Id) {
      return interaction.reply({ content: "Vous ne participez pas à cette partie.", ephemeral: true });
    }

    // Attribution du choix
    if (user.id === game.player1Id) {
      if (game.player1Choice) return interaction.reply({ content: "Vous avez déjà choisi.", ephemeral: true });
      game.player1Choice = choice;
    } else {
      if (game.player2Choice) return interaction.reply({ content: "Vous avez déjà choisi.", ephemeral: true });
      game.player2Choice = choice;
    }

    // Mise à jour du jeu
    pfcGames.set(channel.id, game);
    await interaction.reply({ content: `Vous avez choisi **${choice}**.`, ephemeral: true });

    // Si les deux ont choisi, on calcule résultat
    if (game.player1Choice && game.player2Choice) {
      let resultText;
      const res = determineWinner(game.player1Choice, game.player2Choice);
      if (res === 0) resultText = "Égalité ! 🤝";
      else if (res === 1) resultText = `<@${game.player1Id}> gagne ! 🎉`;
      else resultText = `<@${game.player2Id}> gagne ! 🎉`;

      await channel.send(
        `🕹️ Résultat de la partie entre <@${game.player1Id}> et <@${game.player2Id}> :\n` +
          `- ${choices[0]}: <@${game.player1Id}> a choisi **${game.player1Choice}**\n` +
          `- ${choices[1]}: <@${game.player2Id}> a choisi **${game.player2Choice}**\n` +
          `\n🏆 ${resultText}`
      );

      pfcGames.delete(channel.id);
    }
    return;
  }

  // Gestion Ice Fall

  if (customId === "ice_step") {
    const state = iceFallStates.get(user.id);
    if (!state) return interaction.reply({ content: "Vous n'avez pas de partie Ice Fall en cours. Faites `!icefall` pour commencer.", ephemeral: true });

    // Supprime le message précédent
    if (state.lastMessageId) {
      try {
        const msg = await channel.messages.fetch(state.lastMessageId);
        if (msg) await msg.delete();
      } catch {}
    }

    // On avance un pas
    const stepChance = Math.floor(Math.random() * 6) + 1; // 1 à 6
    if (stepChance === 1) {
      // Tombe dans la glace
      iceFallStates.delete(user.id);
      await interaction.reply({ content: `❄️ Oh non ! Vous êtes tombé dans la glace après ${state.steps} pas ! Partie terminée.`, ephemeral: true });
    } else {
      state.steps++;
      if (state.steps >= MAX_STEPS) {
        iceFallStates.delete(user.id);
        await interaction.reply({ content: `🎉 Bravo ! Vous avez franchi la glace en ${state.steps} pas sans tomber !`, ephemeral: true });
      } else {
        const embed = getIceFallEmbed(state.steps);
        const msg = await channel.send({ embeds: [embed], components: [iceFallButtons()] });
        state.lastMessageId = msg.id;
        iceFallStates.set(user.id, state);
        await interaction.reply({ content: "✅ Pas réussi, continuez !", ephemeral: true });
      }
    }
    return;
  }

  if (customId === "ice_reset") {
    iceFallStates.delete(user.id);
    await interaction.reply({ content: "🔄 Partie Ice Fall réinitialisée. Faites `!icefall` pour recommencer.", ephemeral: true });
  }
});

// ==== LOGIN ====

client.login(process.env.TOKEN);
