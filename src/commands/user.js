const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Comandos para usuários')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ticket')
                .setDescription('Criar um ticket de suporte'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mytickets')
                .setDescription('Ver histórico de seus tickets'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mypurchases')
                .setDescription('Ver suas compras'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('download')
                .setDescription('Baixar produto digital')
                .addIntegerOption(option =>
                    option.setName('product_id')
                        .setDescription('ID do produto para download')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'ticket':
                    await this.createTicket(interaction);
                    break;
                case 'mytickets':
                    await this.showMyTickets(interaction);
                    break;
                case 'mypurchases':
                    await this.showMyPurchases(interaction);
                    break;
                case 'download':
                    await this.downloadProduct(interaction);
                    break;
            }
        } catch (error) {
            console.error('Erro no comando user:', error);
            await interaction.reply({
                content: '❌ Erro interno. Nossa equipe foi notificada.',
                ephemeral: true
            });
        }
    },

    async createTicket(interaction) {
        const { TicketManager } = require('../managers/TicketManager');
        const { DatabaseManager } = require('../database/DatabaseManager');

        const database = new DatabaseManager();
        await database.initialize();

        const ticketManager = new TicketManager(interaction.client, database);
        await ticketManager.createTicket(interaction);

        await database.close();
    },

    async showMyTickets(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const { DatabaseManager } = require('../database/DatabaseManager');
        const { TicketManager } = require('../managers/TicketManager');

        const database = new DatabaseManager();
        await database.initialize();

        try {
            const ticketManager = new TicketManager(interaction.client, database);
            const tickets = await ticketManager.getUserTicketHistory(interaction.user.id);

            if (tickets.length === 0) {
                return await interaction.editReply({
                    content: '📋 Você ainda não criou nenhum ticket.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎫 Seus Tickets')
                .setColor(0x0099FF)
                .setDescription(`Histórico de tickets de <@${interaction.user.id}>:`);

            tickets.forEach((ticket, index) => {
                const createdDate = new Date(ticket.created_at).toLocaleString('pt-BR');
                const closedDate = ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('pt-BR') : 'Ainda aberto';
                const status = ticket.status === 'open' ? '🟢 Aberto' : '🔴 Fechado';

                embed.addFields({
                    name: `Ticket #${ticket.id}`,
                    value: `Status: ${status}\nCriado: ${createdDate}\nFechado: ${closedDate}`,
                    inline: true
                });
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao buscar tickets: ${error.message}`
            });
        } finally {
            await database.close();
        }
    },

    async showMyPurchases(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const { DatabaseManager } = require('../database/DatabaseManager');

        const database = new DatabaseManager();
        await database.initialize();

        try {
            const purchases = await database.getUserSales(interaction.user.id);

            if (purchases.length === 0) {
                return await interaction.editReply({
                    content: '🛒 Você ainda não fez nenhuma compra.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🛍️ Suas Compras')
                .setColor(0x00AE86)
                .setDescription(`Histórico de compras de <@${interaction.user.id}>:`);

            purchases.forEach((purchase, index) => {
                const purchaseDate = new Date(purchase.created_at).toLocaleString('pt-BR');
                const completedDate = purchase.completed_at ? new Date(purchase.completed_at).toLocaleString('pt-BR') : 'Pendente';
                
                let statusEmoji = '';
                let statusText = '';
                
                switch (purchase.status) {
                    case 'completed':
                        statusEmoji = '✅';
                        statusText = 'Concluída';
                        break;
                    case 'pending':
                        statusEmoji = '⏳';
                        statusText = 'Pendente';
                        break;
                    case 'cancelled':
                        statusEmoji = '❌';
                        statusText = 'Cancelada';
                        break;
                    default:
                        statusEmoji = '❓';
                        statusText = 'Desconhecido';
                }

                embed.addFields({
                    name: `${purchase.product_name}`,
                    value: `${statusEmoji} ${statusText}\n💰 R$ ${purchase.amount.toFixed(2)}\n📅 ${purchaseDate}\n✅ ${completedDate}`,
                    inline: true
                });
            });

            const completedPurchases = purchases.filter(p => p.status === 'completed');
            if (completedPurchases.length > 0) {
                embed.addFields({
                    name: '📥 Download',
                    value: 'Use `/user download <product_id>` para baixar seus produtos digitais.',
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao buscar compras: ${error.message}`
            });
        } finally {
            await database.close();
        }
    },

    async downloadProduct(interaction) {
        const productId = interaction.options.getInteger('product_id');
        
        await interaction.deferReply({ ephemeral: true });

        const { DatabaseManager } = require('../database/DatabaseManager');
        const { ProductManager } = require('../managers/ProductManager');

        const database = new DatabaseManager();
        await database.initialize();

        try {
            const productManager = new ProductManager(interaction.client, database);
            const result = await productManager.getDigitalContent(productId, interaction.user.id);

            // Criar arquivo temporário com o conteúdo
            const fs = require('fs');
            const path = require('path');
            
            const downloadDir = './data/downloads';
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }

            const fileName = `${result.productName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
            const filePath = path.join(downloadDir, fileName);
            
            fs.writeFileSync(filePath, result.content, 'utf8');

            const embed = new EmbedBuilder()
                .setTitle('📥 Download do Produto')
                .setDescription(
                    `**Produto:** ${result.productName}\n\n` +
                    `Seu conteúdo digital está anexado abaixo.\n` +
                    `Este arquivo será removido automaticamente em 24 horas por segurança.`
                )
                .setColor(0x00FF00)
                .setFooter({ text: 'Mantenha este conteúdo em segurança' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [filePath]
            });

            // Agendar remoção do arquivo após 24 horas
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (error) {
                    console.error('Erro ao remover arquivo temporário:', error);
                }
            }, 24 * 60 * 60 * 1000); // 24 horas

        } catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message}`
            });
        } finally {
            await database.close();
        }
    }
};
