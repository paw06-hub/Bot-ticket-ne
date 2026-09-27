const { 
    Client, 
    GatewayIntentBits, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require('discord.js');
const express = require('express');

// Khởi tạo Express server để giữ bot sống 24/7 trên Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot Role đang hoạt động ổn định!');
});

app.listen(PORT, () => {
    console.log(`Server web đang chạy trên cổng ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
});

// ================= CẤU HÌNH CHO BOT AUTO ROLE =================
// Khi đưa lên Render, bạn nên cấu hình Biến môi trường (Environment Variables) 
// để bảo mật Token thay vì viết cứng vào code nhé!
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'ĐIỀN_TOKEN_BOT_2_VÀO_ĐÂY';
const CLIENT_ID = process.env.CLIENT_ID || 'ĐIỀN_CLIENT_ID_CỦA_BOT_VÀO_ĐÂY';
const OWNER_ID = process.env.OWNER_ID || 'ĐIỀN_ID_DISCORD_CỦA_BẠN_VÀO_ĐÂY';
// =============================================================

// Nhóm 1: 12 role game ban đầu
const roleConfig1 = [
    { emoji: '9_ygame_lienquan', emojiId: '1553138867127975986', roleId: '1553120963435044884', text: '<:9_ygame_lienquan:1553138867127975986> <@&1553120963435044884>' },
    { emoji: '9_ygame_tft', emojiId: '1553138907212677140', roleId: '1553121311713140786', text: '<:9_ygame_tft:1553138907212677140> <@&1553121311713140786>' },
    { emoji: 'Minecraft', emojiId: '1553139630516347034', roleId: '1553121044057817130', text: '<:Minecraft:1553139630516347034> <@&1553121044057817130>' },
    { emoji: 'amongus', emojiId: '1553317362843779113', roleId: '1553121507373351074', text: '<:amongus:1553317362843779113> <@&1553121507373351074>' },
    { emoji: 'cs2', emojiId: '1553316893861875785', roleId: '1553121125867716729', text: '<:cs2:1553316893861875785> <@&1553121125867716729>' },
    { emoji: 'freefire', emojiId: '1553316932114194522', roleId: '1553121167336800287', text: '<:freefire:1553316932114194522> <@&1553121167336800287>' },
    { emoji: 'lienminh', emojiId: '1553139604893474906', roleId: '1553121085656932466', text: '<:lienminh:1553139604893474906> <@&1553121085656932466>' },
    { emoji: 'ple', emojiId: '1553316967543349332', roleId: '1553121599291400293', text: '<:ple:1553316967543349332> <@&1553121599291400293>' },
    { emoji: 'roblox', emojiId: '1553139536408748034', roleId: '1553121240330535002', text: '<:roblox:1553139536408748034> <@&1553121240330535002>' },
    { emoji: 'steam91', emojiId: '1553139045150761040', roleId: '1553121280365035611', text: '<:steam91:1553139045150761040> <@&1553121280365035611>' },
    { emoji: '9_ygame_gta5', emojiId: '1553771929238904913', roleId: '1553768841270530048', text: '<:9_ygame_gta5:1553771929238904913> <@&1553768841270530048>' },
    { emoji: 'KannaWhat', emojiId: '1553774065624424568', roleId: '1553773720181416107', text: '<:KannaWhat:1553774065624424568> <@&1553773720181416107>' }
];

// Nhóm 2: 3 role đặc biệt
const roleConfig2 = [
    { emoji: 'abowblue2', emojiId: '1553325325293719562', roleId: '1553122069733187695', text: '<a:abowblue2:1553325325293719562> <@&1553122069733187695>' },
    { emoji: 'abowpink94', emojiId: '1553325355337785435', roleId: '1553122100691079208', text: '<a:abowpink94:1553325355337785435> <@&1553122100691079208>' },
    { emoji: 'lgbtqheart', emojiId: '1553326497849151498', roleId: '1553122149391273984', text: '<a:lgbtqheart:1553326497849151498> <@&1553122149391273984>' }
];

// Đăng ký 2 lệnh Slash Command chính
const commands = [
    new SlashCommandBuilder()
        .setName('reaction')
        .setDescription('Gửi bảng 12 role game ban đầu'),
    
    new SlashCommandBuilder()
        .setName('reaction2')
        .setDescription('Gửi bảng 3 role đặc biệt')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[Bot Role] Đã đăng nhập: ${client.user.tag}!`);
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Đã cập nhật lệnh /reaction và /reaction2 thành công!');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const isOwner = interaction.user.id === OWNER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwner && !isAdmin) {
        return interaction.reply({ content: '❌ Bạn không có quyền sử dụng lệnh này!', ephemeral: true });
    }

    if (commandName === 'reaction') {
        await interaction.deferReply({ ephemeral: true });
        let desc = 'Thả cảm xúc vào các icon bên dưới để nhận hoặc hủy role game tương ứng:\n\n';
        roleConfig1.forEach(i => desc += `${i.text}\n`);
        const embed = new EmbedBuilder().setColor('#FF4500').setTitle('🎮 CHỌN ROLE THÔNG BÁO GAME').setDescription(desc);
        const sentMsg = await interaction.channel.send({ embeds: [embed] });
        for (const i of roleConfig1) {
            await sentMsg.react(`${i.emoji}:${i.emojiId}`).catch(() => {});
        }
        await interaction.editReply({ content: '✅ Đã tạo bảng reaction thành công!' });
    }

    if (commandName === 'reaction2') {
        await interaction.deferReply({ ephemeral: true });
        let desc = 'Thả cảm xúc vào các icon bên dưới để nhận hoặc hủy các vai trò đặc biệt:\n\n';
        roleConfig2.forEach(i => desc += `${i.text}\n`);
        const embed = new EmbedBuilder().setColor('#00FFFF').setTitle('✨ CHỌN VAI TRÒ ĐẶC BIỆT').setDescription(desc);
        const sentMsg = await interaction.channel.send({ embeds: [embed] });
        for (const i of roleConfig2) {
            await sentMsg.react(`${i.emoji}:${i.emojiId}`).catch(() => {});
        }
        await interaction.editReply({ content: '✅ Đã tạo bảng reaction 2 thành công!' });
    }
});

// Xử lý thêm role khi thả reaction
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});

    const emojiId = reaction.emoji.id;
    const allConfigs = [...roleConfig1, ...roleConfig2];
    const found = allConfigs.find(item => item.emojiId === emojiId);

    if (!found) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    try {
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(found.roleId);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }
    } catch (error) {
        console.error(error);
    }
});

// Xử lý gỡ role khi bỏ reaction
client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});

    const emojiId = reaction.emoji.id;
    const allConfigs = [...roleConfig1, ...roleConfig2];
    const found = allConfigs.find(item => item.emojiId === emojiId);

    if (!found) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    try {
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.get(found.roleId);
        if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
        }
    } catch (error) {
        console.error(error);
    }
});

client.login(DISCORD_TOKEN);