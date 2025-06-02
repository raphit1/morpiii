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

const ICE_FALL_CHANNEL_ID = "1378737038261620806";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// --- PIERRE FEUILLE CISEAUX ---

const pfcChoices = ["pierre", "feuille", "ciseaux"];

function determineWinner(p1, p2) {
  if (p1 === p2) return "égalité";
  if (
    (p1 === "pierre" && p2 === "ciseaux") ||
    (p1 === "feuille" && p2 === "pierre") ||
    (p1 === "ciseaux" && p2 === "feuille")
  )
    return "joueur";
  return "bot";
}

client.on("messageCreate", async (message) => {
  if (message.channel.id !== ICE_FALL_CHANNEL_ID) return;
  if (message.author.bot) return;

  if (message.content.toLowerCase() === "!pfc") {
    const buttons = new ActionRowBuilder().addComponents(
      pfcChoices.map((choice) =>
        new ButtonBuilder()
          .setCustomId(`pfc_${choice}`)
          .setLabel(choice.charAt(0).toUpperCase() + choice.slice(1))
          .setStyle(ButtonStyle.Primary)
      )
    );
    await message.channel.send({
      content: `${message.author}, choisissez Pierre, Feuille ou Ciseaux :`,
      components: [buttons],
    });
  }

  if (message.content.toLowerCase() === "!icefall") {
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("icefall_step")
        .setLabel("Avancer")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("icefall_stop")
        .setLabel("Abandonner")
        .setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({
      content: `${message.author}, bienvenue dans Ice Fall ! Cliquez sur "Avancer" pour commencer.`,
      components: [buttons],
    });
  }
});

// --- GESTION DES INTERACTIONS ---

const iceFallStates = new Map();

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;

  // PFC buttons
  if (interaction.customId.startsWith("pfc_")) {
    const playerChoice = interaction.customId.split("_")[1];
    const botChoice = pfcChoices[Math.floor(Math.random() * pfcChoices.length)];
    const winner = determineWinner(playerChoice, botChoice);

    let resultText = `Tu as choisi **${playerChoice}**.\nJe choisis **${botChoice}**.\n`;

    if (winner === "égalité") resultText += "C'est une égalité !";
    else if (winner === "joueur") resultText += "Tu as gagné ! 🎉";
    else resultText += "Je gagne cette fois ! 😈";

    await interaction.update({ content: resultText, components: [] });
  }

  // Ice Fall buttons
  if (interaction.customId === "icefall_step") {
    // état ou initialisation
    let state = iceFallStates.get(userId);
    if (!state) {
      state = { step: 0, alive: true };
      iceFallStates.set(userId, state);
    }

    if (!state.alive) {
      await interaction.reply({ content: "Vous êtes déjà tombé dans la glace. Tapez !icefall pour recommencer.", ephemeral: true });
      return;
    }

    state.step++;

    // 1 chance sur 6 de tomber
    const fall = Math.random() < 1 / 6;

    if (fall) {
      state.alive = false;
      await interaction.update({
        content: `${interaction.user} a avancé jusqu'à la case ${state.step}... 💀 Oups, tu es tombé dans la glace ! Jeu terminé.`,
        components: [],
      });
      iceFallStates.delete(userId);
    } else {
      await interaction.update({
        content: `${interaction.user} a avancé jusqu'à la case ${state.step}. Tout va bien, continue !`,
        components: interaction.message.components,
      });
    }
  }

  if (interaction.customId === "icefall_stop") {
    iceFallStates.delete(userId);
    await interaction.update({
      content: `${interaction.user} a abandonné Ice Fall. À bientôt !`,
      components: [],
    });
  }
});

// --- BOT READY ---

client.once("ready", () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
});

// --- LOGIN ---

client.login(process.env.TOKEN);
