const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    AttachmentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle 
} = require('discord.js');
const express = require('express');

// Khởi tạo Express web server để Render duy trì hoạt động 24/7
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('🤖 Ticket Bot is running 24/7 on Render!');
});
app.listen(PORT, () => {
    console.log(`🌐 Web server đang lắng nghe tại cổng ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==================== CẤU HÌNH BOT (ĐỌC TỪ BIẾN MÔI TRƯỜNG RENDER) ====================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'ĐIỀN_TOKEN_BOT_CỦA_BẠN_Ở_ĐÂY'; 
const CLIENT_ID = process.env.CLIENT_ID || 'ĐIỀN_CLIENT_ID_CỦA_BOT_Ở_ĐÂY'; 
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || 'ĐIỀN_ID_CATEGORY_VÀO_ĐÂY'; 
// ====================================================================================

const serverSupportRoles = new Map();
const serverLogChannels = new Map();
const ticketCounters = new Map(); 

const userWarns = new Map();       
const ticketNotes = new Map();     
const userTicketHistory = new Map(); 
const staffStats = new Map();      
const ticketCooldowns = new Map(); 
const totalResolvedTickets = new Map(); 

const commands = [
    new SlashCommandBuilder().setName('addrole').setDescription('Thêm Role hỗ trợ').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    new SlashCommandBuilder().setName('setlog').setDescription('Cài kênh log').addChannelOption(o => o.setName('channel').setDescription('Kênh').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    new SlashCommandBuilder().setName('sendticket').setDescription('Gửi bảng tạo ticket'),
    new SlashCommandBuilder().setName('add').setDescription('Thêm người vào vé').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Xóa người khỏi vé').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('transfer').setDescription('Chuyển vé cho staff').addUserOption(o => o.setName('staff').setDescription('Staff').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Cảnh báo thành viên trong vé').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('note').setDescription('Thêm ghi chú nội bộ cho staff').addStringOption(o => o.setName('content').setDescription('Nội dung').setRequired(true)),
    new SlashCommandBuilder().setName('checkticket').setDescription('Kiểm tra lịch sử vé của user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('topstaff').setDescription('Xem bảng xếp hạng staff xuất sắc'),
    new SlashCommandBuilder().setName('rename').setDescription('Đổi tên kênh ticket hiện tại').addStringOption(o => o.setName('name').setDescription('Tên mới cho kênh').setRequired(true)),
    new SlashCommandBuilder().setName('ticketstats').setDescription('Xem thống kê tổng quan hệ thống ticket của server')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`🤖 Bot đã sẵn sàng! Đăng nhập: ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Đã đăng ký tất cả lệnh thành công!');
    } catch (error) { console.error(error); }
});

async function generateTranscript(channel) {
    let messages = [];
    let lastId;
    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, ...(lastId && { before: lastId }) });
        if (fetched.size === 0) break;
        messages.push(...fetched.values());
        lastId = fetched.lastKey();
        if (fetched.size < 100) break;
    }
    messages.reverse();
    let text = `=== LỊCH SỬ TICKET: ${channel.name} ===\n\n`;
    for (const msg of messages) {
        text += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
    }
    const notes = ticketNotes.get(channel.id);
    if (notes && notes.length > 0) {
        text += `\n=== GHI CHÚ NỘI BỘ STAFF ===\n` + notes.join('\n');
    }
    return Buffer.from(text, 'utf-8');
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member, channel } = interaction;
    const guildId = guild.id;

    if (commandName === 'addrole') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Thiếu quyền!', ephemeral: true });
        const role = interaction.options.getRole('role');
        if (!serverSupportRoles.has(guildId)) serverSupportRoles.set(guildId, []);
        const list = serverSupportRoles.get(guildId);
        if (list.includes(role.id)) return interaction.reply({ content: '⚠️ Đã có rồi!', ephemeral: true });
        list.push(role.id);
        await interaction.reply({ content: `✅ Đã thêm ${role.name}!`, ephemeral: true });
    }

    if (commandName === 'setlog') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Thiếu quyền!', ephemeral: true });
        const logChan = interaction.options.getChannel('channel');
        serverLogChannels.set(guildId, logChan.id);
        await interaction.reply({ content: `✅ Đã đặt kênh log tại ${logChan.name}!`, ephemeral: true });
    }

    if (commandName === 'sendticket') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Thiếu quyền!', ephemeral: true });
        const embed = new EmbedBuilder().setDescription('🗂️ **HỆ THỐNG HỖ TRỢ 24/7**\n\nChọn danh mục bên dưới để mở vé:').setColor(0x2B2D31);
        
        // Cập nhật danh mục theo yêu cầu mới
        const menu = new StringSelectMenuBuilder().setCustomId('ticket_select_menu').setPlaceholder('📂 Chọn danh mục cần hỗ trợ...').addOptions([
            { label: 'Mua Hàng / Dịch Vụ', value: 'cat_muahang', emoji: '🛍️' },
            { label: 'Hỗ Trợ', value: 'cat_support', emoji: '💭' },
            { label: 'Partner / Khác', value: 'cat_partner', emoji: '🤝' }
        ]);

        await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        await interaction.reply({ content: '✅ Đã gửi bảng chọn!', ephemeral: true });
    }

    if (commandName === 'add') {
        const user = interaction.options.getUser('user');
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
        await interaction.reply({ content: `✅ Đã thêm ${user}!` });
    }

    if (commandName === 'remove') {
        const user = interaction.options.getUser('user');
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        await channel.permissionOverwrites.delete(user.id);
        await interaction.reply({ content: `✅ Đã xóa ${user}!` });
    }

    if (commandName === 'transfer') {
        const staff = interaction.options.getUser('staff');
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        await channel.permissionOverwrites.edit(staff.id, { ViewChannel: true, SendMessages: true });
        await interaction.reply({ content: `🔄 Đã chuyển giao cho ${staff}!` });
    }

    if (commandName === 'warn') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const user = interaction.options.getUser('user');
        let warns = userWarns.get(user.id) || 0;
        warns++;
        userWarns.set(user.id, warns);
        await interaction.reply({ content: `⚠️ Đã cảnh báo ${user}. Tổng số lần vi phạm: **${warns}**` });
    }

    if (commandName === 'note') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const content = interaction.options.getString('content');
        if (!ticketNotes.has(channel.id)) ticketNotes.set(channel.id, []);
        ticketNotes.get(channel.id).push(`[${new Date().toLocaleString()}] ${member.user.tag}: ${content}`);
        await interaction.reply({ content: '📝 Đã lưu ghi chú nội bộ!', ephemeral: true });
    }

    if (commandName === 'checkticket') {
        const user = interaction.options.getUser('user');
        const count = userTicketHistory.get(user.id) || 0;
        const warns = userWarns.get(user.id) || 0;
        await interaction.reply({ content: `📊 **Thông tin của ${user.tag}:**\n- Số vé từng mở: **${count} vé**\n- Số lần cảnh báo: **${warns} lần**`, ephemeral: true });
    }

    if (commandName === 'topstaff') {
        if (staffStats.size === 0) return interaction.reply({ content: '📊 Chưa có dữ liệu staff!', ephemeral: true });
        let sorted = [...staffStats.entries()].sort((a, b) => b[1].stars - a[1].stars);
        let text = '🏆 **BẢNG XẾP HẠNG STAFF XUẤT SẮC**\n\n';
        let i = 1;
        for (const [sId, data] of sorted) {
            text += `${i++}. <@${sId}> — **${data.stars} sao** (${data.claims} vé)\n`;
        }
        await interaction.reply({ content: text });
    }

    if (commandName === 'rename') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: '❌ Thiếu quyền quản lý kênh!', ephemeral: true });
        const newName = interaction.options.getString('name');
        await channel.setName(newName);
        await interaction.reply({ content: `✅ Đã đổi tên kênh thành: **${newName}**` });
    }

    if (commandName === 'ticketstats') {
        const openTickets = guild.channels.cache.filter(c => c.name.includes('ticket-')).size;
        const resolved = totalResolvedTickets.get(guild.id) || 0;
        await interaction.reply({ content: `📈 **THỐNG KÊ HỆ THỐNG TICKET SERVER:**\n- Số vé đang mở hiện tại: **${openTickets} vé**\n- Tổng số vé đã xử lý & đóng: **${resolved} vé**`, ephemeral: true });
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.channel.name.includes('ticket-')) return;

    const text = message.content.toLowerCase();
    if (text.includes('stk') || text.includes('ngân hàng') || text.includes('chuyển khoản')) {
        await message.reply({ content: '💳 **Thông tin thanh toán:**\n- Ngân hàng: TPBANK\n- Số tài khoản: `31189838888`\n- Chủ tài khoản: LE BAO TRUNG\n*(Gửi kèm bill vào vé để được xử lý!)*' });
    } else if (text.includes('admin') || text.includes('chủ shop')) {
        await message.reply({ content: '👋 Nhân viên đã nhận được thông báo, sẽ phản hồi bạn ngay lập tức!' });
    }
});

client.on('interactionCreate', async interaction => {
    const guild = interaction.guild;
    const member = interaction.member;
    const channel = interaction.channel;

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const categoryType = interaction.values[0];
        const roleIds = serverSupportRoles.get(guild.id) || [];

        const lastTime = ticketCooldowns.get(member.id) || 0;
        const now = Date.now();
        if (now - lastTime < 30000) {
            const remaining = Math.ceil((30000 - (now - lastTime)) / 1000);
            return interaction.reply({ content: `⏳ Vui lòng chờ **${remaining} giây** nữa mới được mở vé tiếp theo để tránh spam!`, ephemeral: true });
        }
        ticketCooldowns.set(member.id, now);

        let userTotal = userTicketHistory.get(member.id) || 0;
        userTicketHistory.set(member.id, ++userTotal);

        await interaction.deferReply({ ephemeral: true });

        try {
            let currentCount = ticketCounters.get(guild.id) || 0;
            currentCount++;
            ticketCounters.set(guild.id, currentCount);
            const ticketIdStr = String(currentCount).padStart(3, '0');

            const permissionOverwrites = [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
            ];

            roleIds.forEach(id => permissionOverwrites.push({ id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }));

            const ticketChannel = await guild.channels.create({
                name: `ticket-${ticketIdStr}`,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID || null,
                permissionOverwrites,
            });

            const pingRoles = roleIds.map(id => `<@&${id}>`).join(' ');
            
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 TICKET #${ticketIdStr}`)
                .setDescription(`Chào ${member}, vé số #${ticketIdStr} đã được tạo!\n💡 *Mẹo: Gõ "stk" để nhận thông tin chuyển khoản.*`)
                .setColor(0x2B2D31);

            let qrContent = `${member} ${pingRoles}`;
            // Chỉ hiện mã QR nếu chọn danh mục Mua Hàng / Dịch Vụ
            if (categoryType === 'cat_muahang') {
                const qrImageUrl = `https://img.vietqr.io/image/TPB-31189838888-compact2.png?amount=0&addInfo=TICKET%20${ticketIdStr}&accountName=LE%20BAO%20TRUNG`;
                ticketEmbed.addFields({ 
                    name: '💳 Thông tin chuyển khoản TPBank', 
                    value: '- Ngân hàng: **TPBANK**\n- Số tài khoản: `31189838888`\n- Chủ tài khoản: **LE BAO TRUNG**\n- Nội dung: `TICKET ' + ticketIdStr + '`' 
                });
                ticketEmbed.setImage(qrImageUrl);
            }

            const ticketRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Đóng vé').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('Nhận vé').setStyle(ButtonStyle.Secondary).setEmoji('🎟️'),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('Hủy nhận').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
                new ButtonBuilder().setCustomId('lock_ticket').setLabel('Khóa/Mở').setStyle(ButtonStyle.Primary).setEmoji('🔓')
            );

            await ticketChannel.send({ content: qrContent, embeds: [ticketEmbed], components: [ticketRow] });
            await interaction.editReply({ content: `🎉 Ticket #${ticketIdStr} đã tạo: ${ticketChannel}`, ephemeral: true });
        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: '❌ Lỗi tạo vé!', ephemeral: true });
        }
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'claim_ticket') {
        if (!staffStats.has(member.id)) staffStats.set(member.id, { claims: 0, stars: 0 });
        staffStats.get(member.id).claims++;
        await interaction.reply({ content: `✅ **${member}** đã nhận xử lý ticket này!` });
    }

    if (interaction.customId === 'unclaim_ticket') {
        await interaction.reply({ content: `↩️ **${member}** đã hủy nhận vé này, nhường lại cho nhân viên khác tiếp quản!` });
    }

    if (interaction.customId === 'lock_ticket') {
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: '❌ Thiếu quyền!', ephemeral: true });
        const currentOverwrite = channel.permissionOverwrites.cache.get(guild.id);
        const isLocked = currentOverwrite && currentOverwrite.deny.has(PermissionsBitField.Flags.SendMessages);
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: isLocked ? null : false });
        await interaction.reply({ content: isLocked ? '🔓 Đã mở khóa kênh!' : '🔒 Đã khóa kênh!' });
    }

    if (interaction.customId === 'close_ticket') {
        const confirmEmbed = new EmbedBuilder().setTitle('⚠️ XÁC NHẬN ĐÓNG TICKET').setDescription('Bạn có chắc muốn đóng vé này?').setColor(0xFFA500);
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_close').setLabel('Đồng ý').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_close').setLabel('Hủy').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });
    }

    if (interaction.customId === 'cancel_close') {
        await interaction.update({ content: '❌ Đã hủy.', embeds: [], components: [] });
    }

    if (interaction.customId === 'confirm_close') {
        const ratingEmbed = new EmbedBuilder()
            .setTitle('⭐ ĐÁNH GIÁ CHẤT LƯỢNG HỖ TRỢ')
            .setDescription('Cảm ơn bạn đã sử dụng dịch vụ!\nHãy chọn số sao đánh giá bên dưới: 🌟')
            .setColor(0xFFD700);

        const ratingRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rate_1').setLabel('1 ⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rate_2').setLabel('2 ⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rate_3').setLabel('3 ⭐').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rate_4').setLabel('4 ⭐').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('rate_5').setLabel('5 ⭐').setStyle(ButtonStyle.Success)
        );

        await interaction.update({ embeds: [ratingEmbed], components: [ratingRow] });
    }

    if (interaction.customId.startsWith('rate_')) {
        const stars = interaction.customId.split('_')[1];

        for (const [sId, data] of staffStats.entries()) {
            data.stars += Number(stars);
        }

        const modal = new ModalBuilder()
            .setCustomId(`feedback_modal_${stars}`)
            .setTitle('✍️ Ý KIẾN ĐÓNG GÓP');

        const feedbackInput = new TextInputBuilder()
            .setCustomId('feedback_text')
            .setLabel('Nhận xét chi tiết dịch vụ của chúng mình:')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Nhập lời nhận xét (có thể bỏ qua)...');

        modal.addComponents(new ActionRowBuilder().addComponents(feedbackInput));
        await interaction.showModal(modal);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit() || !interaction.customId.startsWith('feedback_modal_')) return;

    const stars = interaction.customId.split('_')[2];
    const feedback = interaction.fields.getTextInputValue('feedback_text') || 'Không có nhận xét';
    const guild = interaction.guild;
    const channel = interaction.channel;
    const member = interaction.member;
    const logChannelId = serverLogChannels.get(guild.id);

    let resolvedCount = totalResolvedTickets.get(guild.id) || 0;
    totalResolvedTickets.set(guild.id, ++resolvedCount);

    await interaction.reply({ content: `❤️ Cảm ơn bạn đã đánh giá **${stars} sao**! Đang lưu lịch sử và xóa kênh sau 5 giây...`, ephemeral: true });

    try {
        const transcriptBuffer = await generateTranscript(channel);
        const attachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.name}.txt` });

        if (logChannelId) {
            const logChan = guild.channels.cache.get(logChannelId);
            if (logChan) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📊 NHẬT KÝ ĐÓNG & ĐÁNH GIÁ TICKET')
                    .addFields(
                        { name: '🏷️ Kênh', value: `${channel.name}`, inline: true },
                        { name: '⭐ Đánh giá', value: `${'⭐'.repeat(Number(stars))} (${stars}/5 sao)`, inline: true },
                        { name: '💬 Nhận xét', value: `${feedback}`, inline: false }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await logChan.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
            }
        }

        try {
            const dmAttachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.name}.txt` });
            await member.send({ content: `📄 Lịch sử vé tại **${guild.name}**:`, files: [dmAttachment] });
        } catch (e) {}

    } catch (e) { console.error(e); }

    setTimeout(async () => {
        try { await channel.delete(); } catch (error) {}
    }, 5000);
});

client.login(DISCORD_TOKEN);
