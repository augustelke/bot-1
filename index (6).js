const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits,
    REST,
    Routes
} = require('discord.js');

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const { statsCommand, handleStats } = require('./stats');

const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const SALON_TOURNOI = '1502723683255320646';
const SALON_ADMIN   = '1502721949376188478';

// ─── Stockage signalements ────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'signals.json');

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return { signals: [] };
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return { signals: [] };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─── Client ────────────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ─── Commandes ─────────────────────────────────────────────────────────────────
const commands = [

    // /tournage
    new SlashCommandBuilder()
        .setName('tournage')
        .setDescription('Créer un tournoi Fortnite')
        .addStringOption(function(opt) {
            return opt.setName('nom').setDescription('Nom du tournoi').setRequired(true);
        })
        .addStringOption(function(opt) {
            return opt.setName('horaires').setDescription('Horaires du tournoi (ex: Samedi 20h-22h)').setRequired(true);
        })
        .addStringOption(function(opt) {
            return opt.setName('description').setDescription('Description du tournoi').setRequired(true);
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    // /signal
    new SlashCommandBuilder()
        .setName('signal')
        .setDescription('Signaler un membre du serveur')
        .addUserOption(function(opt) {
            return opt.setName('utilisateur').setDescription('Le membre à signaler').setRequired(true);
        })
        .addStringOption(function(opt) {
            return opt.setName('raison').setDescription('Raison du signalement').setRequired(true)
                .addChoices(
                    { name: '🤬 Harcèlement', value: 'Harcelement' },
                    { name: '📩 Spam',         value: 'Spam'        },
                    { name: '🎮 Triche',       value: 'Triche'      },
                    { name: '💢 Insultes',     value: 'Insultes'    },
                    { name: '❓ Autre',        value: 'Autre'       }
                );
        })
        .addStringOption(function(opt) {
            return opt.setName('commentaire').setDescription('Détails supplémentaires (optionnel)').setRequired(false);
        })
        .toJSON(),

    // /supsignal
    new SlashCommandBuilder()
        .setName('supsignal')
        .setDescription('Voir et supprimer vos signalements')
        .toJSON(),

    // /adminsignal
    new SlashCommandBuilder()
        .setName('adminsignal')
        .setDescription('Voir tous les signalements du serveur [ADMIN]')
        .addBooleanOption(function(opt) {
            return opt.setName('visible').setDescription('Rendre visible pour tout le monde ?').setRequired(false);
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    // /stats
    statsCommand
];

// ─── Démarrage ─────────────────────────────────────────────────────────────────
client.once('ready', function() {
    console.log('✅ Connecté : ' + client.user.tag);
    var rest = new REST({ version: '10' }).setToken(TOKEN);
    rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands })
        .then(function() { console.log('✅ Commandes enregistrées !'); })
        .catch(function(err) { console.error('❌ Erreur commandes :', err); });
});

// ─── Interactions ──────────────────────────────────────────────────────────────
client.on('interactionCreate', async function(interaction) {

    // ── /stats ────────────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'stats') {
        return handleStats(interaction);
    }

    // ── /tournage ─────────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'tournage') {
        if (interaction.channelId !== SALON_TOURNOI) {
            return interaction.reply({
                content: '❌ Cette commande doit être utilisée dans <#' + SALON_TOURNOI + '>',
                ephemeral: true
            });
        }

        var nom         = interaction.options.getString('nom');
        var horaires    = interaction.options.getString('horaires');
        var description = interaction.options.getString('description');

        var embed = new EmbedBuilder()
            .setTitle('🏆 Tournoi : ' + nom)
            .setDescription(description)
            .addFields({ name: '⏰ Horaires', value: horaires })
            .setColor(0xF4C542)
            .setFooter({ text: 'Clique sur "Participer" pour rejoindre le tournoi !' });

        var bouton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('participer__' + nom)
                .setLabel('🎮 Participer')
                .setStyle(ButtonStyle.Primary)
        );

        var salon = interaction.guild.channels.cache.get(SALON_TOURNOI);
        await salon.send({ embeds: [embed], components: [bouton] });
        return interaction.reply({ content: '✅ Tournoi créé avec succès !', ephemeral: true });
    }

    // ── Bouton Participer ─────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('participer__')) {
        var nomTournoi = interaction.customId.replace('participer__', '');

        var modal = new ModalBuilder()
            .setCustomId('formulaire__' + nomTournoi)
            .setTitle('Inscription : ' + nomTournoi);

        var inputPlateforme = new TextInputBuilder()
            .setCustomId('plateforme')
            .setLabel('Plateforme (PC, PS4, PS5, Xbox, Switch...)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex : PC')
            .setRequired(true);

        var inputPseudo = new TextInputBuilder()
            .setCustomId('pseudo')
            .setLabel('Pseudo Fortnite')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ton pseudo exact dans Fortnite')
            .setRequired(true);

        var inputAge = new TextInputBuilder()
            .setCustomId('age')
            .setLabel('Âge')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex : 18')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(inputPlateforme),
            new ActionRowBuilder().addComponents(inputPseudo),
            new ActionRowBuilder().addComponents(inputAge)
        );

        return interaction.showModal(modal);
    }

    // ── Formulaire inscription tournoi ────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('formulaire__')) {
        var nomT        = interaction.customId.replace('formulaire__', '');
        var plateforme  = interaction.fields.getTextInputValue('plateforme');
        var pseudoF     = interaction.fields.getTextInputValue('pseudo');
        var age         = interaction.fields.getTextInputValue('age');

        var salonAdmin = interaction.guild.channels.cache.get(SALON_ADMIN);

        var embedAdmin = new EmbedBuilder()
            .setTitle('📋 Nouvelle demande — ' + nomT)
            .addFields(
                { name: '👤 Joueur',          value: '<@' + interaction.user.id + '>', inline: true },
                { name: '🎮 Plateforme',      value: plateforme,                       inline: true },
                { name: '🏷️ Pseudo Fortnite', value: pseudoF,                          inline: true },
                { name: '🎂 Âge',             value: age,                              inline: true }
            )
            .setColor(0x3498DB)
            .setTimestamp()
            .setFooter({ text: 'ID : ' + interaction.user.id });

        var boutonsAdmin = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('accepter__' + interaction.user.id + '__' + nomT)
                .setLabel('✅ Accepter')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('refuser__' + interaction.user.id + '__' + nomT)
                .setLabel('❌ Refuser')
                .setStyle(ButtonStyle.Danger)
        );

        await salonAdmin.send({ embeds: [embedAdmin], components: [boutonsAdmin] });
        return interaction.reply({
            content: '✅ Ta demande a bien été envoyée ! Tu recevras une notification.',
            ephemeral: true
        });
    }

    // ── Boutons Accepter / Refuser tournoi ────────────────────────────────────
    if (interaction.isButton() && (interaction.customId.startsWith('accepter__') || interaction.customId.startsWith('refuser__'))) {
        var parts      = interaction.customId.split('__');
        var action     = parts[0];
        var userId     = parts[1];
        var nomTournoi2 = parts[2];

        var membre;
        try {
            membre = await interaction.guild.members.fetch(userId);
        } catch (e) {
            return interaction.reply({ content: '❌ Impossible de trouver ce joueur.', ephemeral: true });
        }

        if (action === 'accepter') {
            try {
                await membre.send('🎉 **Félicitations !** Tu as été **accepté(e)** dans le tournoi **' + nomTournoi2 + '** !\nPrépare-toi bien, bonne chance ! 🏆');
            } catch (e) {
                console.log('Impossible d\'envoyer un DM à ' + userId);
            }
            var embedOk = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0x2ECC71)
                .setFooter({ text: '✅ Accepté par ' + interaction.user.username });
            return interaction.update({ embeds: [embedOk], components: [] });

        } else {
            try {
                await membre.send('❌ Ta demande pour le tournoi **' + nomTournoi2 + '** a été **refusée**.\nTu peux retenter pour le prochain tournoi !');
            } catch (e) {
                console.log('Impossible d\'envoyer un DM à ' + userId);
            }
            var embedKo = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0xE74C3C)
                .setFooter({ text: '❌ Refusé par ' + interaction.user.username });
            return interaction.update({ embeds: [embedKo], components: [] });
        }
    }

    // ── /signal ───────────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'signal') {
        var cible       = interaction.options.getUser('utilisateur');
        var raison      = interaction.options.getString('raison');
        var commentaire = interaction.options.getString('commentaire') || 'Aucun commentaire';

        if (cible.id === interaction.user.id)
            return interaction.reply({ content: '❌ Tu ne peux pas te signaler toi-même !', ephemeral: true });
        if (cible.bot)
            return interaction.reply({ content: '❌ Tu ne peux pas signaler un bot.', ephemeral: true });

        var data = loadData();
        data.signals.push({
            id:           crypto.randomUUID(),
            reporterId:   interaction.user.id,
            reporterName: interaction.user.username,
            reportedId:   cible.id,
            reportedName: cible.username,
            raison:       raison,
            commentaire:  commentaire,
            timestamp:    new Date().toISOString(),
            guildId:      interaction.guildId
        });
        saveData(data);

        return interaction.reply({
            content: '✅ Signalement envoyé contre **' + cible.username + '** pour **' + raison + '**. Merci !',
            ephemeral: true
        });
    }

    // ── /supsignal ────────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'supsignal') {
        var data2      = loadData();
        var mesSignaux = data2.signals.filter(function(s) {
            return s.reporterId === interaction.user.id && s.guildId === interaction.guildId;
        });

        if (mesSignaux.length === 0)
            return interaction.reply({ content: '📭 Tu n\'as fait aucun signalement.', ephemeral: true });

        var derniers = mesSignaux.slice().reverse().slice(0, 25);

        var lignes = derniers.map(function(s, i) {
            var ts = Math.floor(new Date(s.timestamp).getTime() / 1000);
            return '**' + (i + 1) + '.** <@' + s.reportedId + '> — ' + s.raison + '\n> ' + s.commentaire + '\n> 🕐 <t:' + ts + ':R>';
        }).join('\n\n');

        var embedSup = new EmbedBuilder()
            .setTitle('📋 Mes signalements')
            .setDescription(lignes)
            .setColor(0xE67E22)
            .setFooter({ text: 'Sélectionne un signalement dans le menu pour le supprimer' });

        var selectMenu = new StringSelectMenuBuilder()
            .setCustomId('supsignal_select')
            .setPlaceholder('🗑️ Choisir un signalement à supprimer...')
            .addOptions(derniers.map(function(s) {
                return {
                    label:       (s.reportedName + ' — ' + s.raison).slice(0, 100),
                    description: new Date(s.timestamp).toLocaleDateString('fr-FR'),
                    value:       s.id
                };
            }));

        return interaction.reply({
            embeds:     [embedSup],
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral:  true
        });
    }

    // ── Select menu suppression ───────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'supsignal_select') {
        var signalId = interaction.values[0];
        var data3    = loadData();
        var index    = data3.signals.findIndex(function(s) {
            return s.id === signalId && s.reporterId === interaction.user.id;
        });

        if (index === -1)
            return interaction.reply({ content: '❌ Signalement introuvable ou déjà supprimé.', ephemeral: true });

        data3.signals.splice(index, 1);
        saveData(data3);
        return interaction.reply({ content: '✅ Signalement supprimé avec succès !', ephemeral: true });
    }

    // ── /adminsignal ──────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'adminsignal') {
        var visible = interaction.options.getBoolean('visible') === true;
        var data4   = loadData();
        var signaux = data4.signals.filter(function(s) { return s.guildId === interaction.guildId; });

        if (signaux.length === 0)
            return interaction.reply({ content: '📭 Aucun signalement sur ce serveur.', ephemeral: !visible });

        var compteur = {};
        signaux.forEach(function(s) {
            if (!compteur[s.reportedId])
                compteur[s.reportedId] = { name: s.reportedName, count: 0, commentaires: [] };
            compteur[s.reportedId].count++;
            if (s.commentaire && s.commentaire !== 'Aucun commentaire')
                compteur[s.reportedId].commentaires.push('"' + s.commentaire + '" — par **' + s.reporterName + '**');
        });

        var sorted = Object.entries(compteur).sort(function(a, b) { return b[1].count - a[1].count; });

        var classement = sorted.map(function(entry, i) {
            var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '**' + (i + 1) + '.**';
            return medal + ' <@' + entry[0] + '> — **' + entry[1].count + '** signalement' + (entry[1].count > 1 ? 's' : '');
        }).join('\n');

        var allComments = [];
        sorted.forEach(function(entry) {
            entry[1].commentaires.forEach(function(c) {
                allComments.push('<@' + entry[0] + '> : ' + c);
            });
        });

        var embedAdmin2 = new EmbedBuilder()
            .setTitle('🚨 Tableau des signalements')
            .addFields(
                { name: '📊 Classement',   value: classement                              || 'Aucun' },
                { name: '💬 Commentaires', value: allComments.slice(0, 15).join('\n') || 'Aucun commentaire' }
            )
            .setColor(0xE74C3C)
            .setTimestamp()
            .setFooter({ text: signaux.length + ' signalement' + (signaux.length > 1 ? 's' : '') + ' au total' });

        return interaction.reply({ embeds: [embedAdmin2], ephemeral: !visible });
    }
});

client.login(TOKEN);
