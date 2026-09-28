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

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'ĐIỀN_TOKEN_BOT_CỦA_BẠN_Ở_ĐÂY'; 
const CLIENT_ID = process.env.CLIENT_ID || 'ĐIỀN_CLIENT_ID_CỦA_BOT_Ở_ĐÂY'; 
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || 'ĐIỀN_ID_CATEGORY_VÀO_ĐÂY'; 

// ID CỦA CHỦ BOT GỐC (Ní thay ID Discord của ní vào đây)[span_1](start_span)[span_1](end_span)
const BOT_OWNER_ID = process.env.BOT_OWNER_ID || '1065176214013444158';

// Danh sách các admin phụ được cấp quyền thêm qua lệnh /addadmin
const extraAdmins = new Set();

const serverSupportRoles = new Map();
const serverLogChannels = new Map();
const ticketCounters = new Map(); 

const userWarns = new Map();       
const ticketNotes = new Map();     
const userTicketHistory = new Map(); 
const staffStats = new Map();      
const ticketCooldowns = new Map(); 
const totalResolvedTickets = new Map(); 
const ticketLanguages = new Map(); 
const ticketRefs = new Map();      

const serverTicketLimits = new Map();       
const serverAutoCloseHours = new Map();     
const customDatabaseVouchers = new Map(); 

const commands = [
    // Lệnh quản trị cấp cao
    new SlashCommandBuilder().setName('addrole').setDescription('[Chủ Bot] Thêm Role hỗ trợ').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    new SlashCommandBuilder().setName('setlog').setDescription('[Chủ Bot] Cài kênh log').addChannelOption(o => o.setName('channel').setDescription('Kênh').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    new SlashCommandBuilder().setName('sendticket').setDescription('[Chủ Bot] Gửi bảng tạo ticket'),
    new SlashCommandBuilder().setName('admin-create-voucher').setDescription('[Chủ Bot] Tạo mã giảm giá mới vào hệ thống').addStringOption(o => o.setName('code').setDescription('Mã giảm giá (VD: TET2026)').setRequired(true)).addStringOption(o => o.setName('discount').setDescription('Giá trị giảm (VD: 50K hoặc 20%)').setRequired(true)),
    new SlashCommandBuilder().setName('admin-force-close').setDescription('[Chủ Bot] Ép buộc đóng và xóa ngay kênh vé hiện tại'),
    new SlashCommandBuilder().setName('admin-set-limit').setDescription('[Chủ Bot] Đặt giới hạn số vé mở đồng thời cho mỗi user').addIntegerOption(o => o.setName('limit').setDescription('Số lượng vé tối đa cùng lúc').setRequired(true)),
    new SlashCommandBuilder().setName('admin-auto-close-config').setDescription('[Chủ Bot] Cấu hình thời gian tự động đóng vé không hoạt động').addIntegerOption(o => o.setName('hours').setDescription('Số giờ (Nhập 0 để tắt)').setRequired(true)),
    new SlashCommandBuilder().setName('admin-note-history').setDescription('[Chủ Bot] Xem toàn bộ ghi chú nội bộ của staff theo user').addUserOption(o => o.setName('user').setDescription('User cần kiểm tra').setRequired(true)),
    new SlashCommandBuilder().setName('admin-staff-reset').setDescription('[Chủ Bot] Đặt lại toàn bộ điểm số, sao và XP của tất cả staff'),

    // Lệnh thêm Admin mới ngay trong Discord
    new SlashCommandBuilder()
        .setName('addadmin')
        .setDescription('[Chủ Bot] Cấp quyền Chủ Bot/Admin phụ cho một người khác')
        .addUserOption(o => o.setName('user').setDescription('Thành viên cần cấp quyền').setRequired(true)),

    // Panel & Say
    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('[Chủ Bot] Gửi bảng thông báo dịch vụ hoặc menu tạo vé kèm nút bấm')
        .addStringOption(o => o.setName('title').setDescription('Tiêu đề bảng thông báo').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Nội dung chi tiết').setRequired(true))
        .addStringOption(o => o.setName('button_label').setDescription('Tên hiển thị trên nút bấm').setRequired(true))
        .addStringOption(o => o.setName('button_custom_id').setDescription('Mã định danh (custom_id) của nút').setRequired(true)),

    new SlashCommandBuilder()
        .setName('say')
        .setDescription('[Chủ Bot] Sai bot gửi một tin nhắn nội dung tùy chỉnh')
        .addStringOption(o => o.setName('message').setDescription('Nội dung bạn muốn bot nói').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Kênh gửi tới (để trống nếu gửi kênh hiện tại)').addChannelTypes(ChannelType.GuildText).setRequired(false)),

    // Lệnh thông thường
    new SlashCommandBuilder().setName('add').setDescription('Thêm người vào vé').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Xóa người khỏi vé').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('transfer').setDescription('Chuyển vé cho staff').addUserOption(o => o.setName('staff').setDescription('Staff').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Cảnh báo thành viên trong vé').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('note').setDescription('Thêm ghi chú nội bộ cho staff').addStringOption(o => o.setName('content').setDescription('Nội dung').setRequired(true)),
    new SlashCommandBuilder().setName('checkticket').setDescription('Kiểm tra lịch sử vé của user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('topstaff').setDescription('Xem bảng xếp hạng staff xuất sắc'),
    new SlashCommandBuilder().setName('staff-leaderboard').setDescription('Xem bảng xếp hạng điểm thưởng (XP) và thành tích Staff chi tiết'),
    new SlashCommandBuilder().setName('rename').setDescription('Đổi tên kênh ticket hiện tại').addStringOption(o => o.setName('name').setDescription('Tên mới cho kênh').setRequired(true)),
    new SlashCommandBuilder().setName('ticketstats').setDescription('Xem thống kê tổng quan hệ thống ticket của server'),
    new SlashCommandBuilder().setName('voucher').setDescription('Áp dụng mã giảm giá đã tạo vào vé').addStringOption(o => o.setName('code').setDescription('Mã giảm giá').setRequired(true)),
    new SlashCommandBuilder().setName('invoice').setDescription('Tạo hóa đơn thanh toán nhanh cho khách').addStringOption(o => o.setName('item').setDescription('Tên sản phẩm/dịch vụ').setRequired(true)).addStringOption(o => o.setName('price').setDescription('Số tiền cần thanh toán').setRequired(true)),
    new SlashCommandBuilder().setName('ref').setDescription('Thêm mã giới thiệu (Partner) cho đơn hàng').addStringOption(o => o.setName('code').setDescription('Mã giới thiệu của Partner').setRequired(true))
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
    const refCode = ticketRefs.get(channel.id);
    if (refCode) {
        text += `\n=== MÃ GIỚI THIỆU (PARTNER) ===\nPartner Code: ${refCode}\n`;
    }
    return Buffer.from(text, 'utf-8');
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, member, user, channel } = interaction;
    const guildId = guild.id;

    // Kiểm tra xem user có phải Chủ Bot gốc hoặc Admin phụ được add vào không
    const isOwner = (user.id === BOT_OWNER_ID) || extraAdmins.has(user.id);
    const restrictedCommands = ['addrole', 'setlog', 'sendticket', 'admin-create-voucher', 'admin-force-close', 'admin-set-limit', 'admin-auto-close-config', 'admin-note-history', 'admin-staff-reset', 'addadmin', 'panel', 'say'];
    
    if (restrictedCommands.includes(commandName) && !isOwner) {
        return interaction.reply({ content: '❌ Chỉ có **Chủ Bot** mới có quyền thực thi lệnh này!', ephemeral: true });
    }

    if (commandName === 'addadmin') {
        const targetUser = interaction.options.getUser('user');
        extraAdmins.add(targetUser.id);
        return interaction.reply({ content: `✅ Đã cấp quyền Chủ Bot/Admin phụ thành công cho ${targetUser}!` });
    }

    if (commandName === 'addrole') {
        const role = interaction.options.getRole('role');
        if (!serverSupportRoles.has(guildId)) serverSupportRoles.set(guildId, []);
        const list = serverSupportRoles.get(guildId);
        if (list.includes(role.id)) return interaction.reply({ content: '⚠️ Đã có rồi!', ephemeral: true });
        list.push(role.id);
        await interaction.reply({ content: `✅ Đã thêm ${role.name}!`, ephemeral: true });
    }

    if (commandName === 'setlog') {
        const logChan = interaction.options.getChannel('channel');
        serverLogChannels.set(guildId, logChan.id);
        await interaction.reply({ content: `✅ Đã đặt kênh log tại ${logChan.name}!`, ephemeral: true });
    }

    if (commandName === 'sendticket') {
        const embed = new EmbedBuilder().setDescription('🗂️ **HỆ THỐNG HỖ TRỢ / SUPPORT SYSTEM**\n\n🇻🇳 Chọn ngôn ngữ & danh mục để mở vé:\n🇬🇧 Choose language & category to open a ticket:').setColor(0x2B2D31);
        
        const menu = new StringSelectMenuBuilder().setCustomId('ticket_select_menu').setPlaceholder('📂 Chọn ngôn ngữ & dịch vụ... / Select service...').addOptions([
            { label: '[VI] Mua Hàng / Dịch Vụ', value: 'vi_muahang', emoji: '🛍️' },
            { label: '[VI] Hỗ Trợ Chung', value: 'vi_support', emoji: '💭' },
            { label: '[EN] Purchase / Services', value: 'en_muahang', emoji: '🛒' },
            { label: '[EN] General Support', value: 'en_support', emoji: '💡' }
        ]);

        await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
        await interaction.reply({ content: '✅ Đã gửi bảng chọn!', ephemeral: true });
    }

    if (commandName === 'admin-create-voucher') {
        const code = interaction.options.getString('code').toUpperCase();
        const discount = interaction.options.getString('discount');
        customDatabaseVouchers.set(code, discount);
        await interaction.reply({ content: `🎟️ Đã tạo và lưu thành công mã giảm giá mới:\n- Mã: **${code}**\n- Mức giảm: **${discount}**`, ephemeral: true });
    }

    if (commandName === 'panel') {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const buttonLabel = interaction.options.getString('button_label');
        const buttonCustomId = interaction.options.getString('button_custom_id');

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(0x0099ff)
            .setFooter({ text: `Được vận hành bởi ${client.user.username}`, iconURL: client.user.displayAvatarURL() });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(buttonCustomId)
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Đã tạo Panel thành công!', ephemeral: true });
    }

    if (commandName === 'say') {
        const message = interaction.options.getString('message');
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            await targetChannel.send(message);
            await interaction.reply({ content: `✅ Đã gửi tin nhắn thành công vào kênh ${targetChannel} !`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Có lỗi xảy ra khi gửi tin nhắn (Bot có thể thiếu quyền).', ephemeral: true });
        }
    }

    if (commandName === 'add') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const targetUser = interaction.options.getUser('user');
        await channel.permissionOverwrites.edit(targetUser.id, { ViewChannel: true, SendMessages: true });
        await interaction.reply({ content: `✅ Đã thêm ${targetUser}!` });
    }

    if (commandName === 'remove') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const targetUser = interaction.options.getUser('user');
        await channel.permissionOverwrites.delete(targetUser.id);
        await interaction.reply({ content: `✅ Đã xóa ${targetUser}!` });
    }

    if (commandName === 'transfer') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const staff = interaction.options.getUser('staff');
        await channel.permissionOverwrites.edit(staff.id, { ViewChannel: true, SendMessages: true });
        await interaction.reply({ content: `🔄 Đã chuyển giao cho ${staff}!` });
    }

    if (commandName === 'warn') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const targetUser = interaction.options.getUser('user');
        let warns = userWarns.get(targetUser.id) || 0;
        warns++;
        userWarns.set(targetUser.id, warns);
        await interaction.reply({ content: `⚠️ Đã cảnh báo ${targetUser}. Tổng số lần vi phạm: **${warns}**` });
    }

    if (commandName === 'note') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const content = interaction.options.getString('content');
        if (!ticketNotes.has(channel.id)) ticketNotes.set(channel.id, []);
        
        const noteEntry = `[${new Date().toLocaleString()}] Staff: ${member.user.tag} — ${content}`;
        ticketNotes.get(channel.id).push(noteEntry);
        
        await interaction.reply({ content: '📝 Đã lưu ghi chú nội bộ!', ephemeral: true });
    }

    if (commandName === 'checkticket') {
        const targetUser = interaction.options.getUser('user');
        const count = userTicketHistory.get(targetUser.id) || 0;
        const warns = userWarns.get(targetUser.id) || 0;
        await interaction.reply({ content: `📊 **Thông tin của ${targetUser.tag}:**\n- Số vé từng mở: **${count} vé**\n- Số lần cảnh báo: **${warns} lần**`, ephemeral: true });
    }

    if (commandName === 'topstaff') {
        if (staffStats.size === 0) return interaction.reply({ content: '📊 Chưa có dữ liệu staff!', ephemeral: true });
        let sorted = [...staffStats.entries()].sort((a, b) => b[1].stars - a[1].stars);
        let text = '🏆 **BẢNG XẾP HẠNG STAFF XUẤT SẮC (THEO SAO)**\n\n';
        let i = 1;
        for (const [sId, data] of sorted) {
            text += `${i++}. <@${sId}> — **${data.stars} sao** (${data.claims} vé)\n`;
        }
        await interaction.reply({ content: text });
    }

    if (commandName === 'staff-leaderboard') {
        if (staffStats.size === 0) return interaction.reply({ content: '📊 Chưa có dữ liệu bảng xếp hạng staff!', ephemeral: true });
        let sorted = [...staffStats.entries()].sort((a, b) => b[1].xp - a[1].xp);
        let text = '🌟 **BẢNG XẾP HẠNG ĐIỂM THƯỞNG (XP) STAFF**\n\n';
        let i = 1;
        for (const [sId, data] of sorted) {
            text += `${i++}. <@${sId}> ➔ Điểm XP: **${data.xp}** | Vé nhận: **${data.claims}** | Tổng sao: **${data.stars}⭐**\n`;
        }
        await interaction.reply({ content: text });
    }

    if (commandName === 'admin-staff-reset') {
        staffStats.clear();
        await interaction.reply({ content: '🔄 Đã làm mới (reset) toàn bộ bảng điểm thưởng, số sao và số vé của tất cả nhân viên thành công!', ephemeral: true });
    }

    if (commandName === 'rename') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        const newName = interaction.options.getString('name');
        await channel.setName(newName);
        await interaction.reply({ content: `✅ Đã đổi tên kênh thành: **${newName}**` });
    }

    if (commandName === 'ticketstats') {
        const openTickets = guild.channels.cache.filter(c => c.name.includes('ticket-')).size;
        const resolved = totalResolvedTickets.get(guild.id) || 0;
        await interaction.reply({ content: `📈 **THỐNG KÊ HỆ THỐNG TICKET SERVER:**\n- Số vé đang mở hiện tại: **${openTickets} vé**\n- Tổng số vé đã xử lý & đóng: **${resolved} vé**`, ephemeral: true });
    }

    if (commandName === 'voucher') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Lệnh này chỉ dùng trong kênh vé!', ephemeral: true });
        const code = interaction.options.getString('code').toUpperCase();
        const lang = ticketLanguages.get(channel.id) || 'vi';

        if (!customDatabaseVouchers.has(code)) {
            return interaction.reply({ content: `❌ Mã giảm giá **${code}** không tồn tại hoặc đã hết hạn!`, ephemeral: true });
        }

        const discountValue = customDatabaseVouchers.get(code);
        const desc = lang === 'en' ? `Voucher code **${code}** (${discountValue} OFF) applied successfully!` : `Mã giảm giá **${code}** với mức giảm **${discountValue}** đã được áp dụng vào đơn hàng!`;
        
        const voucherEmbed = new EmbedBuilder().setTitle('🎟️ VOUCHER APPLIED').setDescription(desc).setColor(0x00FF00);
        await interaction.reply({ embeds: [voucherEmbed] });
    }

    if (commandName === 'invoice') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Lệnh này chỉ dùng trong kênh vé!', ephemeral: true });
        const item = interaction.options.getString('item');
        const price = interaction.options.getString('price');
        
        const invoiceEmbed = new EmbedBuilder()
            .setTitle('🧾 HÓA ĐƠN / INVOICE')
            .addFields(
                { name: '📦 Sản phẩm / Item', value: `${item}`, inline: false },
                { name: '💰 Tổng tiền / Total', value: `**${price} VNĐ**`, inline: false }
            )
            .setColor(0x3498DB)
            .setTimestamp();

        await interaction.reply({ embeds: [invoiceEmbed] });
    }

    if (commandName === 'ref') {
        if (!channel.name.includes('ticket-')) return interaction.reply({ content: '❌ Lệnh này chỉ dùng trong kênh vé!', ephemeral: true });
        const code = interaction.options.getString('code');
        ticketRefs.set(channel.id, code.toUpperCase());
        await interaction.reply({ content: `🤝 Đã ghi nhận mã giới thiệu Partner: **${code.toUpperCase()}** cho đơn hàng này!` });
    }

    if (commandName === 'admin-force-close') {
        if (!channel.name.includes('ticket-')) {
            return interaction.reply({ content: '❌ Chỉ dùng trong kênh vé!', ephemeral: true });
        }

        await interaction.reply({ content: '⚡ Chủ bot đã yêu cầu hủy khẩn cấp kênh này.' });
        setTimeout(async () => {
            try { await channel.delete(); } catch (e) {}
        }, 1500);
    }

    if (commandName === 'admin-set-limit') {
        const limit = interaction.options.getInteger('limit');
        serverTicketLimits.set(guildId, limit);
        await interaction.reply({ content: `⚙️ Đã cập nhật giới hạn số vé tối đa mỗi user có thể mở cùng lúc: **${limit} vé**`, ephemeral: true });
    }

    if (commandName === 'admin-auto-close-config') {
        const hours = interaction.options.getInteger('hours');
        serverAutoCloseHours.set(guildId, hours);
        if (hours > 0) {
            await interaction.reply({ content: `⏰ Đã bật tự động đóng vé sau **${hours} giờ** không hoạt động.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `🛑 Đã tắt tính năng tự động đóng vé.`, ephemeral: true });
        }
    }

    if (commandName === 'admin-note-history') {
        const targetUser = interaction.options.getUser('user');
        
        let foundNotes = [];
        for (const [chanId, notesArr] of ticketNotes.entries()) {
            const chan = guild.channels.cache.get(chanId);
            if (chan && chan.permissionOverwrites.cache.has(targetUser.id)) {
                foundNotes.push(`📂 **Kênh ${chan.name}:**\n` + notesArr.join('\n'));
            }
        }

        if (foundNotes.length === 0) {
            return interaction.reply({ content: `📋 Không tìm thấy ghi chú nào liên quan đến thành viên ${targetUser.tag}.`, ephemeral: true });
        }

        let responseText = `📋 **LỊCH SỬ GHI CHÚ NỘI BỘ CHO ${targetUser.tag}:**\n\n` + foundNotes.join('\n\n');
        if (responseText.length > 2000) responseText = responseText.substring(0, 1990) + '...';

        await interaction.reply({ content: responseText, ephemeral: true });
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.channel.name.includes('ticket-')) return;

    if (message.attachments.size > 0) {
        const hasImage = message.attachments.some(att => att.contentType && att.contentType.startsWith('image/'));
        if (hasImage) {
            await message.react('🔍');
            const lang = ticketLanguages.get(message.channel.id) || 'vi';
            const textReply = lang === 'en' ? '📸 **Image/Bill received!** Staff will verify it shortly.' : '📸 **Hệ thống đã nhận được hình ảnh (Bill)!** Nhân viên sẽ kiểm tra sớm.';
            await message.reply({ content: textReply });
            return;
        }
    }

    const text = message.content.toLowerCase();
    if (text.includes('stk') || text.includes('ngân hàng') || text.includes('chuyển khoản') || text.includes('bank')) {
        await message.reply({ content: '💳 **Thông tin thanh toán / Payment Info:**\n- Bank: TPBANK\n- STK: `31189838888`\n- Name: LE BAO TRUNG' });
    }
});

client.on('interactionCreate', async interaction => {
    const guild = interaction.guild;
    const member = interaction.member;
    const channel = interaction.channel;

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const selectedValue = interaction.values[0]; 
        const lang = selectedValue.startsWith('en') ? 'en' : 'vi';
        const categoryType = selectedValue.includes('muahang') ? 'cat_muahang' : 'cat_support';

        await createTicketChannel(interaction, categoryType, lang);
    }

    if (!interaction.isButton()) return;

    const lang = channel && ticketLanguages.get(channel.id) || 'vi';

    if (interaction.customId === 'claim_ticket') {
        if (!staffStats.has(member.id)) staffStats.set(member.id, { claims: 0, stars: 0, xp: 0 });
        const staffData = staffStats.get(member.id);
        staffData.claims++;
        staffData.lastClaimedChannel = channel.id;

        const msg = lang === 'en' ? `✅ **${member}** has claimed this ticket!` : `✅ **${member}** đã nhận xử lý ticket này!`;
        await interaction.reply({ content: msg });
    }

    if (interaction.customId === 'unclaim_ticket') {
        const staffData = staffStats.get(member.id);
        if (staffData && staffData.lastClaimedChannel === channel.id) {
            staffData.lastClaimedChannel = null;
        }
        const msg = lang === 'en' ? `↩️ **${member}** unclamed this ticket.` : `↩️ **${member}** đã hủy nhận vé này!`;
        await interaction.reply({ content: msg });
    }

    if (interaction.customId === 'lock_ticket') {
        const isOwner = (interaction.user.id === BOT_OWNER_ID) || extraAdmins.has(interaction.user.id);
        if (!isOwner) {
            return interaction.reply({ content: '❌ Chỉ có Chủ Bot mới có quyền khóa/mở kênh này!', ephemeral: true });
        }
        const currentOverwrite = channel.permissionOverwrites.cache.get(guild.id);
        const isLocked = currentOverwrite && currentOverwrite.deny.has(PermissionsBitField.Flags.SendMessages);
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: isLocked ? null : false });
        await interaction.reply({ content: isLocked ? '🔓 Unlocked!' : '🔒 Locked!' });
    }

    if (interaction.customId === 'close_ticket') {
        const title = lang === 'en' ? '⚠️ CONFIRM CLOSE' : '⚠️ XÁC NHẬN ĐÓNG TICKET';
        const desc = lang === 'en' ? 'Are you sure you want to close this ticket?' : 'Bạn có chắc muốn đóng vé này?';
        const confirmEmbed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0xFFA500);
        
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_close').setLabel(lang === 'en' ? 'Confirm' : 'Đồng ý').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_close').setLabel(lang === 'en' ? 'Cancel' : 'Hủy').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });
    }

    if (interaction.customId === 'cancel_close') {
        await interaction.update({ content: '❌ Canceled.', embeds: [], components: [] });
    }

    if (interaction.customId === 'confirm_close') {
        const ratingTitle = lang === 'en' ? '⭐ RATE OUR SERVICE' : '⭐ ĐÁNH GIÁ CHẤT LƯỢNG HỖ TRỢ';
        const ratingDesc = lang === 'en' ? 'Please rate your experience below: 🌟' : 'Hãy chọn số sao đánh giá bên dưới: 🌟';
        
        const ratingEmbed = new EmbedBuilder().setTitle(ratingTitle).setDescription(ratingDesc).setColor(0xFFD700);

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
        const stars = Number(interaction.customId.split('_')[1]);

        for (const [sId, data] of staffStats.entries()) {
            if (data.lastClaimedChannel === channel.id) {
                data.stars += stars;
                data.xp += stars * 10;
                data.lastClaimedChannel = null;
                break;
            } else {
                data.stars += stars;
                data.xp += stars * 5;
            }
        }

        const modal = new ModalBuilder()
            .setCustomId(`feedback_modal_${stars}`)
            .setTitle(lang === 'en' ? '✍️ FEEDBACK' : '✍️ Ý KIẾN ĐÓNG GÓP');

        const feedbackInput = new TextInputBuilder()
            .setCustomId('feedback_text')
            .setLabel(lang === 'en' ? 'Your feedback:' : 'Nhận xét chi tiết dịch vụ:')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(feedbackInput));
        await interaction.showModal(modal);
    }
});

async function createTicketChannel(interaction, categoryType, lang) {
    const guild = interaction.guild;
    const member = interaction.member;
    const guildId = guild.id;
    const roleIds = serverSupportRoles.get(guildId) || [];

    const maxLimit = serverTicketLimits.get(guildId) || 1;
    const activeUserTickets = guild.channels.cache.filter(c => c.name.includes('ticket-') && c.permissionOverwrites.cache.has(member.id)).size;
    if (activeUserTickets >= maxLimit) {
        const limitMsg = lang === 'en' ? `❌ You have reached the maximum limit of **${maxLimit}** open ticket(s) at the same time!` : `❌ Bạn đã đạt giới hạn tối đa **${maxLimit}** vé mở đồng thời! Vui lòng đóng vé cũ trước khi mở vé mới.`;
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({ content: limitMsg, components: [] });
        }
        return interaction.reply({ content: limitMsg, ephemeral: true });
    }

    const lastTime = ticketCooldowns.get(member.id) || 0;
    const now = Date.now();
    if (now - lastTime < 30000) {
        const remaining = Math.ceil((30000 - (now - lastTime)) / 1000);
        const msgText = lang === 'en' ? `⏳ Please wait **${remaining}s** before opening another ticket!` : `⏳ Vui lòng chờ **${remaining} giây** nữa!`;
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({ content: msgText, components: [] });
        }
        return interaction.reply({ content: msgText, ephemeral: true });
    }
    ticketCooldowns.set(member.id, now);

    let userTotal = userTicketHistory.get(member.id) || 0;
    userTicketHistory.set(member.id, ++userTotal);

    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
    }

    try {
        let currentCount = ticketCounters.get(guildId) || 0;
        currentCount++;
        ticketCounters.set(guildId, currentCount);
        const ticketIdStr = String(currentCount).padStart(3, '0');

        const permissionOverwrites = [
            { id: guildId, deny: [PermissionsBitField.Flags.ViewChannel] },
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

        ticketLanguages.set(ticketChannel.id, lang);

        const pingRoles = roleIds.map(id => `<@&${id}>`).join(' ');
        
        let titleText = lang === 'en' ? `🎫 TICKET #${ticketIdStr}` : `🎫 TICKET #${ticketIdStr}`;
        let descText = lang === 'en' ? `Hello ${member}, your ticket has been created!` : `Chào ${member}, vé số #${ticketIdStr} đã được tạo!`;

        const ticketEmbed = new EmbedBuilder()
            .setTitle(titleText)
            .setDescription(descText)
            .setColor(0x2B2D31);

        let qrContent = `${member} ${pingRoles}`;
        if (categoryType === 'cat_muahang') {
            const qrImageUrl = `https://img.vietqr.io/image/TPB-31189838888-compact2.png?amount=0&addInfo=TICKET%20${ticketIdStr}&accountName=LE%20BAO%20TRUNG`;
            const bankTitle = lang === 'en' ? '💳 TPBank Payment Info' : '💳 Thông tin chuyển khoản TPBank';
            ticketEmbed.addFields({ 
                name: bankTitle, 
                value: '- Bank: **TPBANK**\n- STK: `31189838888`\n- Name: **LE BAO TRUNG**\n- Content: `TICKET ' + ticketIdStr + '`' 
            });
            ticketEmbed.setImage(qrImageUrl);
        }

        const closeBtnText = lang === 'en' ? 'Close' : 'Đóng vé';
        const claimBtnText = lang === 'en' ? 'Claim' : 'Nhận vé';
        const unclaimBtnText = lang === 'en' ? 'Unclaim' : 'Hủy nhận';
        const lockBtnText = lang === 'en' ? 'Lock/Unlock' : 'Khóa/Mở';

        const ticketRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel(closeBtnText).setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('claim_ticket').setLabel(claimBtnText).setStyle(ButtonStyle.Secondary).setEmoji('🎟️'),
            new ButtonBuilder().setCustomId('unclaim_ticket').setLabel(unclaimBtnText).setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
            new ButtonBuilder().setCustomId('lock_ticket').setLabel(lockBtnText).setStyle(ButtonStyle.Primary).setEmoji('🔓')
        );

        await ticketChannel.send({ content: qrContent, embeds: [ticketEmbed], components: [ticketRow] });

        const ruleTitle = lang === 'en' ? '📌 RULES & GUIDELINES' : '📌 NỘI QUY & HƯỚNG DẪN';
        const ruleDesc = lang === 'en' ? '1. State your request clearly.\n2. Send payment receipt (bill) directly here if purchasing.' : '1. Trình bày rõ nhu cầu.\n2. Gửi hình ảnh bill chuyển khoản trực tiếp vào đây.';
        
        const ruleEmbed = new EmbedBuilder().setTitle(ruleTitle).setDescription(ruleDesc).setColor(0xE67E22);
        
        const pinnedMsg = await ticketChannel.send({ embeds: [ruleEmbed] });
        await pinnedMsg.pin().catch(() => {});

        const successMsg = lang === 'en' ? `🎉 Ticket created: ${ticketChannel}` : `🎉 Đã tạo thành công: ${ticketChannel}`;
        await interaction.editReply({ content: successMsg, components: [], ephemeral: true });
    } catch (e) {
        console.error(e);
        await interaction.editReply({ content: '❌ Lỗi tạo vé!', components: [], ephemeral: true });
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit() || !interaction.customId.startsWith('feedback_modal_')) return;

    const stars = interaction.customId.split('_')[2];
    const feedback = interaction.fields.getTextInputValue('feedback_text') || 'No feedback';
    const guild = interaction.guild;
    const channel = interaction.channel;
    const logChannelId = serverLogChannels.get(guild.id);
    const lang = ticketLanguages.get(channel.id) || 'vi';

    let resolvedCount = totalResolvedTickets.get(guild.id) || 0;
    totalResolvedTickets.set(guild.id, ++resolvedCount);

    const replyMsg = lang === 'en' ? `❤️ Thanks for rating **${stars} stars**! Deleting channel in 5s...` : `❤️ Cảm ơn bạn đã đánh giá **${stars} sao**! Đang xóa kênh sau 5 giây...`;
    await interaction.reply({ content: replyMsg, ephemeral: true });

    try {
        const transcriptBuffer = await generateTranscript(channel);
        const attachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.name}.txt` });

        if (logChannelId) {
            const logChan = guild.channels.cache.get(logChannelId);
            if (logChan) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📊 TICKET TRANSCRIPT & LOG')
                    .addFields(
                        { name: '🏷️ Channel', value: `${channel.name}`, inline: true },
                        { name: '⭐ Rating', value: `${'⭐'.repeat(Number(stars))} (${stars}/5)`, inline: true },
                        { name: '🤝 Partner Ref', value: `${ticketRefs.get(channel.id) || 'None'}`, inline: true },
                        { name: '💬 Feedback', value: `${feedback}`, inline: false }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await logChan.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
            }
        }
    } catch (e) { console.error(e); }

    setTimeout(async () => {
        try { await channel.delete(); } catch (error) {}
    }, 5000);
});

client.login(DISCORD_TOKEN);
