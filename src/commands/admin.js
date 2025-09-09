const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Comandos administrativos do bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Estatísticas do bot'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('product')
                .setDescription('Gerenciar produtos')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Ação a ser executada')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Criar', value: 'create' },
                            { name: 'Listar', value: 'list' },
                            { name: 'Editar', value: 'edit' },
                            { name: 'Deletar', value: 'delete' }
                        ))
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID do produto (para editar/deletar)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Nome do produto')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Descrição do produto')
                        .setRequired(false))
                .addNumberOption(option =>
                    option.setName('price')
                        .setDescription('Preço do produto')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('image')
                        .setDescription('URL da imagem do produto')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('Conteúdo digital do produto')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('stock')
                        .setDescription('Quantidade em estoque (-1 para ilimitado)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('blacklist')
                .setDescription('Gerenciar blacklist de usuários')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Ação a ser executada')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Adicionar', value: 'add' },
                            { name: 'Remover', value: 'remove' }
                        ))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Usuário para blacklist')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Motivo da blacklist')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('Limpeza de dados antigos'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('security')
                .setDescription('Logs de segurança')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Número de logs para mostrar')
                        .setRequired(false))),

    async execute(interaction) {
        const { SecurityManager } = require('../security/SecurityManager');
        const { DatabaseManager } = require('../database/DatabaseManager');
        const { ProductManager } = require('../managers/ProductManager');
        const { TicketManager } = require('../managers/TicketManager');

        const security = new SecurityManager();
        
        // Verificar se é admin
        if (!security.isAdmin(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'stats':
                    await this.handleStats(interaction);
                    break;
                case 'product':
                    await this.handleProduct(interaction);
                    break;
                case 'blacklist':
                    await this.handleBlacklist(interaction);
                    break;
                case 'cleanup':
                    await this.handleCleanup(interaction);
                    break;
                case 'security':
                    await this.handleSecurity(interaction);
                    break;
            }
        } catch (error) {
            console.error('Erro no comando admin:', error);
            await interaction.reply({
                content: '❌ Erro interno. Verifique os logs.',
                ephemeral: true
            });
        }
    },

    async handleStats(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const database = new DatabaseManager();
        await database.initialize();

        const productManager = new ProductManager(interaction.client, database);
        const ticketManager = new TicketManager(interaction.client, database);

        const productStats = await productManager.getProductStats();
        const ticketStats = await ticketManager.getTicketStats();

        const embed = new EmbedBuilder()
            .setTitle('📊 Estatísticas do Bot')
            .setColor(0x0099FF)
            .addFields(
                {
                    name: '🎫 Tickets',
                    value: `Total: ${ticketStats.total}\nAbertos: ${ticketStats.open}\nFechados: ${ticketStats.closed}`,
                    inline: true
                },
                {
                    name: '🛍️ Produtos',
                    value: `Total: ${productStats.totalProducts}\nAtivos: ${productStats.activeProducts}`,
                    inline: true
                },
                {
                    name: '💰 Vendas',
                    value: `Completadas: ${productStats.totalSales}\nReceita: R$ ${productStats.totalRevenue.toFixed(2)}\nPendentes: ${productStats.pendingSales}`,
                    inline: true
                }
            )
            .setTimestamp();

        if (productStats.topSellingProducts.length > 0) {
            const topProducts = productStats.topSellingProducts
                .map(p => `${p.name}: ${p.sales} vendas (R$ ${p.revenue.toFixed(2)})`)
                .join('\n');
            
            embed.addFields({
                name: '🏆 Top Produtos',
                value: topProducts,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
        await database.close();
    },

    async handleProduct(interaction) {
        const action = interaction.options.getString('action');
        
        await interaction.deferReply({ ephemeral: true });

        const database = new DatabaseManager();
        await database.initialize();
        const productManager = new ProductManager(interaction.client, database);

        switch (action) {
            case 'create':
                await this.createProduct(interaction, productManager);
                break;
            case 'list':
                await this.listProducts(interaction, productManager);
                break;
            case 'edit':
                await this.editProduct(interaction, productManager);
                break;
            case 'delete':
                await this.deleteProduct(interaction, productManager);
                break;
        }

        await database.close();
    },

    async createProduct(interaction, productManager) {
        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description');
        const price = interaction.options.getNumber('price');
        const image = interaction.options.getString('image');
        const content = interaction.options.getString('content');
        const stock = interaction.options.getInteger('stock') || -1;

        if (!name || !price) {
            return await interaction.editReply({
                content: '❌ Nome e preço são obrigatórios para criar um produto.'
            });
        }

        try {
            const productId = await productManager.createProduct({
                name: name,
                description: description,
                price: price,
                imageUrl: image,
                digitalContent: content,
                stockQuantity: stock
            });

            await interaction.editReply({
                content: `✅ Produto criado com sucesso! ID: ${productId}`
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao criar produto: ${error.message}`
            });
        }
    },

    async listProducts(interaction, productManager) {
        const products = productManager.getAllProducts();

        if (products.length === 0) {
            return await interaction.editReply({
                content: '📦 Nenhum produto encontrado.'
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📦 Lista de Produtos')
            .setColor(0x00AE86);

        products.forEach(product => {
            const stockText = product.stock_quantity === -1 ? '∞' : product.stock_quantity;
            const statusText = product.is_active ? '✅ Ativo' : '❌ Inativo';
            
            embed.addFields({
                name: `ID ${product.id}: ${product.name}`,
                value: `Preço: R$ ${product.price.toFixed(2)}\nEstoque: ${stockText}\nVendas: ${product.sales_count}\nStatus: ${statusText}`,
                inline: true
            });
        });

        await interaction.editReply({ embeds: [embed] });
    },

    async editProduct(interaction, productManager) {
        const productId = interaction.options.getInteger('id');
        
        if (!productId) {
            return await interaction.editReply({
                content: '❌ ID do produto é obrigatório para editar.'
            });
        }

        const updates = {};
        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description');
        const price = interaction.options.getNumber('price');
        const image = interaction.options.getString('image');
        const content = interaction.options.getString('content');
        const stock = interaction.options.getInteger('stock');

        if (name) updates.name = name;
        if (description) updates.description = description;
        if (price) updates.price = price;
        if (image) updates.image_url = image;
        if (content) updates.digitalContent = content;
        if (stock !== null) updates.stock_quantity = stock;

        if (Object.keys(updates).length === 0) {
            return await interaction.editReply({
                content: '❌ Nenhuma alteração especificada.'
            });
        }

        try {
            await productManager.updateProduct(productId, updates);
            await interaction.editReply({
                content: `✅ Produto ${productId} atualizado com sucesso!`
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao atualizar produto: ${error.message}`
            });
        }
    },

    async deleteProduct(interaction, productManager) {
        const productId = interaction.options.getInteger('id');
        
        if (!productId) {
            return await interaction.editReply({
                content: '❌ ID do produto é obrigatório para deletar.'
            });
        }

        try {
            await productManager.deleteProduct(productId);
            await interaction.editReply({
                content: `✅ Produto ${productId} desativado com sucesso!`
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao desativar produto: ${error.message}`
            });
        }
    },

    async handleBlacklist(interaction) {
        const action = interaction.options.getString('action');
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'Não especificado';

        await interaction.deferReply({ ephemeral: true });

        const security = new SecurityManager();

        try {
            if (action === 'add') {
                await security.blacklistUser(user.id, reason);
                await interaction.editReply({
                    content: `✅ Usuário ${user.username} adicionado à blacklist.\nMotivo: ${reason}`
                });
            } else if (action === 'remove') {
                await security.removeFromBlacklist(user.id);
                await interaction.editReply({
                    content: `✅ Usuário ${user.username} removido da blacklist.`
                });
            }
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao gerenciar blacklist: ${error.message}`
            });
        }
    },

    async handleCleanup(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const database = new DatabaseManager();
            await database.initialize();
            
            await database.cleanupOldData();
            
            const ticketManager = new TicketManager(interaction.client, database);
            await ticketManager.cleanupOrphanedTickets();

            await database.close();

            await interaction.editReply({
                content: '✅ Limpeza de dados concluída com sucesso!'
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro na limpeza: ${error.message}`
            });
        }
    },

    async handleSecurity(interaction) {
        const limit = interaction.options.getInteger('limit') || 10;

        await interaction.deferReply({ ephemeral: true });

        try {
            const database = new DatabaseManager();
            await database.initialize();
            
            const logs = await database.getSecurityLogs(limit);
            await database.close();

            if (logs.length === 0) {
                return await interaction.editReply({
                    content: '📋 Nenhum log de segurança encontrado.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 Logs de Segurança')
                .setColor(0xFF0000)
                .setDescription(`Últimos ${logs.length} eventos de segurança:`);

            logs.forEach((log, index) => {
                const date = new Date(log.created_at).toLocaleString('pt-BR');
                const data = log.data ? JSON.parse(log.data) : {};
                
                embed.addFields({
                    name: `${index + 1}. ${log.event_type}`,
                    value: `Data: ${date}\nUsuário: ${log.user_id || 'N/A'}\nDados: ${JSON.stringify(data).substring(0, 100)}...`,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao buscar logs: ${error.message}`
            });
        }
    }
};
