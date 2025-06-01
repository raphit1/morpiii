const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// --- PFC (Pierre-Feuille-Ciseaux) ---

const pfcGames = new Map();
const pfcChoices = ["Pierre", "Feuille", "Ciseaux"];

function getPfcWinner(c1, c2) {
  if (c1 === c2) return 0; // égalité
  if (
    (c1 === "Pierre" && c2 === "Ciseaux") ||
    (c1 === "Feuille" && c2 === "Pierre") ||
    (c1 === "Ciseaux" && c2 === "Feuille")
  ) return 1;
  return 2;
}

// --- Ice Fall ---

const iceFallGames = new Map();

function rollIceFall() {
  return Math.floor(Math.random() * 6) + 1; // 1 à 6
}

const ICEFALL_MAX_STEPS = 10;

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  // --- Commande PFC ---

  if (content.startsWith("!pfc")) {
    if (pfcGames.has(message.channel.id)) {
      return message.reply("Une partie de PFC est déjà en cours dans ce salon.");
    }

    const args = content.split(/\s+/);
    if (args.length < 2 || message.mentions.users.size < 1) {
      return message.reply("Usage : !pfc @adversaire");
    }

    const opponent = message.mentions.users.first();

    if (opponent.bot) return message.reply("Tu ne peux pas jouer contre un bot.");
    if (opponent.id === message.author.id) return message.reply("Tu ne peux pas jouer contre toi-même.");

    pfcGames.set(message.channel.id, {
      players: [message.author.id, opponent.id],
      choices: new Map()
    });

    const row1 = new ActionRowBuilder();
    pfcChoices.forEach(choice => {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`pfc_${message.author.id}_${choice}`)
          .setLabel(choice)
          .setStyle(ButtonStyle.Primary)
      );
    });

    const row2 = new ActionRowBuilder();
    pfcChoices.forEach(choice => {
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`pfc_${opponent.id}_${choice}`)
          .setLabel(choice)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    await message.channel.send({
      content: `${message.author} vs ${opponent} ! Choisissez votre coup :`,
      components: [row1, row2]
    });

    return;
  }

  // --- Commande IceFall ---

  if (content === "!icefall") {
    if (iceFallGames.has(message.author.id)) {
      return message.reply("Tu as déjà une partie Ice Fall en cours !");
    }

    iceFallGames.set(message.author.id, { step: 0, alive: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`icefall_step_${message.author.id}`)
        .setLabel("Faire un pas")
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({
      content: `${message.author}, la partie Ice Fall commence ! Tu es sur la glace, avance prudemment...`,
      components: [row]
    });

    return;
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  // --- PFC buttons ---

  if (customId.startsWith("pfc_")) {
    const [prefix, userId, choice] = customId.split("_");
    const game = pfcGames.get(interaction.channel.id);

    if (!game) {
      return interaction.reply({ content: "Aucune partie PFC en cours ici.", ephemeral: true });
    }

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "Ce n'est pas ton bouton !", ephemeral: true });
    }

    if (game.choices.has(userId)) {
      return interaction.reply({ content: "Tu as déjà joué.", ephemeral: true });
    }

    game.choices.set(userId, choice);
    await interaction.deferUpdate();

    if (game.choices.size === 2) {
      const p1 = game.players[0];
      const p2 = game.players[1];
      const c1 = game.choices.get(p1);
      const c2 = game.choices.get(p2);

      let resultMsg;
      const winner = getPfcWinner(c1, c2);
      if (winner === 0) {
        resultMsg = `Égalité ! Les deux joueurs ont choisi **${c1}**.`;
      } else if (winner === 1) {
        resultMsg = `<@${p1}> gagne avec **${c1}** contre **${c2}** !`;
      } else {
        resultMsg = `<@${p2}> gagne avec **${c2}** contre **${c1}** !`;
      }

      await interaction.followUp({ content: resultMsg });
      pfcGames.delete(interaction.channel.id);
    }
    return;
  }

  // --- IceFall buttons ---

  if (customId.startsWith("icefall_step_")) {
    const userId = customId.split("_")[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "Ce n'est pas ton bouton !", ephemeral: true });
    }

    const game = iceFallGames.get(userId);
    if (!game || !game.alive) {
      return interaction.reply({ content: "Tu n'as pas de partie Ice Fall en cours.", ephemeral: true });
    }

    // Faire un pas
    const roll = rollIceFall();
    game.step++;

    let msg;
    if (roll === 1) {
      game.alive = false;
      msg = `Oh non ! Tu es tombé dans la glace au pas ${game.step} ❄️🥶. Partie terminée.`;
      iceFallGames.delete(userId);
    } else if (game.step >= ICEFALL_MAX_STEPS) {
      game.alive = false;
      msg = `Bravo ! Tu as réussi à faire ${ICEFALL_MAX_STEPS} pas sans tomber, tu as survécu à l'Ice Fall ! 🎉`;
      iceFallGames.delete(userId);
    } else {
      msg = `Pas ${game.step} fait, tu as survécu. (Chance de tomber 1/6 à chaque pas) Continue ?`;
    }

    const row = new ActionRowBuilder();

    if (game.alive) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`icefall_step_${userId}`)
          .setLabel("Faire un pas")
          .setStyle(ButtonStyle.Success)
      );
    }

    await interaction.update({
      content: `<@${userId}> ${msg}`,
      components: game.alive ? [row] : []
    });

    return;
  }
});

client.login(process.env.TOKEN);
