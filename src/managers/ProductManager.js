const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType
} = require('discord.js');
const { Logger } = require('../utils/Logger');

class ProductManager {
    constructor(client, database) {
        this.client = client;
        this.database = database;
        this.logger = new Logger();
        this.maxProducts = 30; // Limite de 30 slots conforme solicitado
        this.productsCache = new Map();
        this.productEmbedMessage = null;
    }

    async initializeProductSystem() {
        try {
            // Carregar produtos do banco de dados
            await this.loadProductsFromDatabase();
            
            // Enviar/atualizar embed de produtos no canal designado
            await this.updateProductsDisplay();
            
            this.logger.info('Sistema de produtos inicializado com sucesso.');
        } catch (error) {
            this.logger.error('Erro ao inicializar sistema de produtos:', error);
            throw error;
        }
    }

    async loadProductsFromDatabase() {
        const products = await this.database.getProducts(true);
        this.productsCache.clear();
        
        for (const product of products) {
            this.productsCache.set(product.id, product);
        }
        
        this.logger.info(`${products.length} produtos carregados no cache.`);
    }

    async createProduct(productData) {
        // Verificar se já atingiu o limite de produtos
        if (this.productsCache.size >= this.maxProducts) {
            return { success: false, error: `Limite máximo de ${this.maxProducts} produtos atingido.` };
        }

        // Validar dados do produto
        try {
            this.validateProductData(productData);
        } catch (error) {
            return { success: false, error: error.message };
        }

        try {
            // Criptografar conteúdo digital se fornecido
            if (productData.digitalContent) {
                const { SecurityManager } = require('../security/SecurityManager');
                const security = new SecurityManager();
                productData.digitalContent = security.encrypt(productData.digitalContent);
            }

            // Criar produto no banco de dados
            const result = await this.database.createProduct({
                name: productData.name,
                description: productData.description,
                price: parseFloat(productData.price),
                imageUrl: productData.imageUrl,
                digitalContent: productData.digitalContent,
                stockQuantity: productData.stockQuantity || -1 // -1 = ilimitado
            });

            // Recarregar produtos
            await this.loadProductsFromDatabase();
            
            // Atualizar display
            await this.updateProductsDisplay();

            this.logger.info(`Produto criado: ${productData.name} (ID: ${result.id})`);
            return result.id;

        } catch (error) {
            this.logger.error('Erro ao criar produto:', error);
            throw error;
        }
    }

    validateProductData(productData) {
        if (!productData.name || productData.name.trim().length === 0) {
            throw new Error('Nome do produto é obrigatório.');
        }
        
        if (!productData.price || isNaN(parseFloat(productData.price)) || parseFloat(productData.price) <= 0) {
            throw new Error('Preço deve ser um número válido maior que zero.');
        }
        
        if (productData.name.length > 100) {
            throw new Error('Nome do produto deve ter no máximo 100 caracteres.');
        }
        
        if (productData.description && productData.description.length > 500) {
            throw new Error('Descrição deve ter no máximo 500 caracteres.');
        }
    }

    async updateProduct(productId, updates) {
        const product = this.productsCache.get(productId);
        if (!product) {
            throw new Error('Produto não encontrado.');
        }

        // Validar atualizações
        if (updates.name !== undefined) {
            if (!updates.name || updates.name.trim().length === 0) {
                throw new Error('Nome do produto não pode estar vazio.');
            }
        }

        if (updates.price !== undefined) {
            if (isNaN(parseFloat(updates.price)) || parseFloat(updates.price) <= 0) {
                throw new Error('Preço deve ser um número válido maior que zero.');
            }
        }

        // Criptografar novo conteúdo digital se fornecido
        if (updates.digitalContent) {
            const { SecurityManager } = require('../security/SecurityManager');
            const security = new SecurityManager();
            updates.digitalContent = security.encrypt(updates.digitalContent);
        }

        await this.database.updateProduct(productId, updates);
        await this.loadProductsFromDatabase();
        await this.updateProductsDisplay();

        this.logger.info(`Produto atualizado: ID ${productId}`);
    }

    async deleteProduct(productId) {
        const product = this.productsCache.get(productId);
        if (!product) {
            throw new Error('Produto não encontrado.');
        }

        // Desativar produto em vez de deletar (manter histórico)
        await this.database.updateProduct(productId, { is_active: 0 });
        await this.loadProductsFromDatabase();
        await this.updateProductsDisplay();

        this.logger.info(`Produto desativado: ${product.name} (ID: ${productId})`);
    }

    async updateProductsDisplay() {
        const channelId = process.env.PRODUCTS_CHANNEL_ID;
        if (!channelId) {
            this.logger.warn('Canal de produtos não configurado (PRODUCTS_CHANNEL_ID).');
            return;
        }

        const channel = this.client.channels.cache.get(channelId);
        if (!channel) {
            this.logger.error('Canal de produtos não encontrado.');
            return;
        }

        try {
            // Criar embed principal
            const mainEmbed = this.createMainProductEmbed();
            
            // Criar componentes (botões para produtos)
            const components = await this.createProductComponents();

            // Se já existe uma mensagem, editar. Senão, criar nova.
            if (this.productEmbedMessage) {
                try {
                    await this.productEmbedMessage.edit({
                        embeds: [mainEmbed],
                        components: components
                    });
                } catch (error) {
                    // Mensagem pode ter sido deletada, criar nova
                    this.productEmbedMessage = null;
                }
            }

            if (!this.productEmbedMessage) {
                // Limpar mensagens antigas do bot no canal
                const messages = await channel.messages.fetch({ limit: 50 });
                const botMessages = messages.filter(msg => msg.author.id === this.client.user.id);
                
                for (const message of botMessages.values()) {
                    try {
                        await message.delete();
                    } catch (error) {
                        // Ignorar erros de mensagens já deletadas
                    }
                }

                // Criar nova mensagem
                this.productEmbedMessage = await channel.send({
                    embeds: [mainEmbed],
                    components: components
                });
            }

        } catch (error) {
            this.logger.error('Erro ao atualizar display de produtos:', error);
        }
    }

    createMainProductEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('🛍️ Loja de Produtos Digitais')
            .setDescription(
                '**Bem-vindo à nossa loja exclusiva!**\n\n' +
                '🔹 Clique em um produto abaixo para abrir um ticket de compra\n' +
                '🔹 Cada usuário pode ter apenas 1 ticket ativo por vez\n' +
                '🔹 Produtos digitais são entregues instantaneamente após confirmação do pagamento\n' +
                '🔹 Suporte 24/7 disponível\n\n' +
                '**Produtos disponíveis:**'
            )
            .setColor(0x00AE86)
            .setThumbnail(this.client.user.displayAvatarURL())
            .setFooter({ 
                text: 'Sistema Seguro de Vendas | Clique nos botões abaixo', 
                iconURL: this.client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Adicionar produtos como fields
        const products = Array.from(this.productsCache.values()).slice(0, this.maxProducts);
        
        if (products.length === 0) {
            embed.addFields({
                name: '📦 Nenhum produto disponível',
                value: 'Em breve novos produtos serão adicionados!',
                inline: false
            });
        } else {
            products.forEach((product, index) => {
                const stockText = product.stock_quantity === -1 
                    ? '∞' 
                    : product.stock_quantity.toString();
                
                embed.addFields({
                    name: `${index + 1}. ${product.name}`,
                    value: `💰 R$ ${product.price.toFixed(2)} | 📦 Estoque: ${stockText}\n${product.description || 'Sem descrição'}`,
                    inline: true
                });
            });
        }

        return embed;
    }

    async createProductComponents() {
        const products = Array.from(this.productsCache.values()).slice(0, this.maxProducts);
        const components = [];

        if (products.length === 0) {
            return components;
        }

        // Criar botões em grupos de 5 (limite do Discord por ActionRow)
        const buttonGroups = [];
        for (let i = 0; i < products.length; i += 5) {
            buttonGroups.push(products.slice(i, i + 5));
        }

        buttonGroups.forEach((group, groupIndex) => {
            const actionRow = new ActionRowBuilder();
            
            group.forEach((product, productIndex) => {
                const globalIndex = (groupIndex * 5) + productIndex + 1;
                
                // Verificar se produto tem estoque
                const isOutOfStock = product.stock_quantity === 0;
                
                const button = new ButtonBuilder()
                    .setCustomId(`product_${product.id}`)
                    .setLabel(`${globalIndex}. R$ ${product.price.toFixed(2)}`)
                    .setStyle(isOutOfStock ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setDisabled(isOutOfStock);

                // Adicionar emoji se disponível
                if (globalIndex <= 10) {
                    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                    button.setEmoji(emojis[globalIndex - 1]);
                }

                actionRow.addComponents(button);
            });

            components.push(actionRow);
        });

        return components;
    }

    async handleProductPurchase(interaction, productId) {
        const userId = interaction.user.id;
        const productIdNum = parseInt(productId);

        try {
            // Verificar se produto existe
            const product = this.productsCache.get(productIdNum);
            if (!product) {
                return await interaction.reply({
                    content: '❌ Produto não encontrado ou não disponível.',
                    ephemeral: true
                });
            }

            // Verificar estoque
            if (product.stock_quantity === 0) {
                return await interaction.reply({
                    content: '❌ Este produto está fora de estoque.',
                    ephemeral: true
                });
            }

            // Verificar se usuário já tem ticket ativo
            const existingTickets = await this.database.getUserActiveTickets(userId);
            if (existingTickets.length > 0) {
                const ticketChannel = this.client.channels.cache.get(existingTickets[0].channel_id);
                const channelMention = ticketChannel ? `<#${ticketChannel.id}>` : 'canal não encontrado';
                
                return await interaction.reply({
                    content: `❌ Você já possui um ticket ativo: ${channelMention}\nFeche o ticket atual antes de abrir outro.`,
                    ephemeral: true
                });
            }

            // Criar embed de confirmação
            const confirmEmbed = new EmbedBuilder()
                .setTitle('🛒 Confirmar Compra')
                .setDescription(
                    `Você está prestes a abrir um ticket para:\n\n` +
                    `**${product.name}**\n` +
                    `💰 Preço: R$ ${product.price.toFixed(2)}\n` +
                    `📝 ${product.description || 'Sem descrição'}\n\n` +
                    `Um ticket exclusivo será criado para você com nossa equipe de vendas.`
                )
                .setColor(0x0099FF)
                .setThumbnail(product.image_url || null)
                .setFooter({ text: 'Clique em "Confirmar" para prosseguir' });

            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_purchase_${productId}`)
                        .setLabel('✅ Confirmar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel_purchase')
                        .setLabel('❌ Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );

            const response = await interaction.reply({
                embeds: [confirmEmbed],
                components: [confirmRow],
                ephemeral: true
            });

            // Aguardar confirmação
            const filter = (i) => {
                return i.user.id === userId && 
                       (i.customId === `confirm_purchase_${productId}` || i.customId === 'cancel_purchase');
            };

            try {
                const confirmation = await response.awaitMessageComponent({ 
                    filter, 
                    time: 60000,
                    componentType: ComponentType.Button
                });

                if (confirmation.customId === 'cancel_purchase') {
                    await confirmation.update({
                        content: '❌ Compra cancelada.',
                        embeds: [],
                        components: []
                    });
                    return;
                }

                // Confirmar compra - criar ticket
                await confirmation.deferUpdate();
                
                const { TicketManager } = require('./TicketManager');
                const ticketManager = new TicketManager(this.client, this.database);
                
                await ticketManager.createTicket(confirmation, productIdNum);

                // Criar registro de venda pendente
                await this.database.createSale({
                    userId: userId,
                    productId: productIdNum,
                    amount: product.price,
                    status: 'pending'
                });

                // Log da tentativa de compra
                await this.database.logSecurityEvent('PURCHASE_INITIATED', userId, {
                    productId: productIdNum,
                    productName: product.name,
                    amount: product.price,
                    timestamp: Date.now()
                });

                await confirmation.editReply({
                    content: '✅ Ticket de compra criado com sucesso! Verifique o canal criado.',
                    embeds: [],
                    components: []
                });

            } catch (error) {
                if (error.code === 'InteractionCollectorError') {
                    await interaction.editReply({
                        content: '⏰ Tempo esgotado. Tente novamente.',
                        embeds: [],
                        components: []
                    });
                } else {
                    throw error;
                }
            }

        } catch (error) {
            this.logger.error('Erro ao processar compra:', error);
            
            const errorMessage = '❌ Erro interno ao processar compra. Nossa equipe foi notificada.';
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    async completeSale(saleId, paymentMethod = null, transactionId = null) {
        try {
            // Atualizar venda como completa
            await this.database.updateSale(saleId, {
                status: 'completed',
                payment_method: paymentMethod,
                transaction_id: transactionId,
                completed_at: Date.now()
            });

            // Obter dados da venda
            const sale = await this.database.get('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (!sale) {
                throw new Error('Venda não encontrada');
            }

            // Incrementar contador de vendas do produto
            await this.database.incrementProductSales(sale.product_id);

            // Decrementar estoque se não for ilimitado
            const product = await this.database.getProduct(sale.product_id);
            if (product && product.stock_quantity > 0) {
                await this.database.updateProduct(sale.product_id, {
                    stock_quantity: product.stock_quantity - 1
                });
            }

            // Recarregar produtos e atualizar display
            await this.loadProductsFromDatabase();
            await this.updateProductsDisplay();

            // Log da venda completada
            await this.database.logSecurityEvent('SALE_COMPLETED', sale.user_id, {
                saleId: saleId,
                productId: sale.product_id,
                amount: sale.amount,
                paymentMethod: paymentMethod,
                timestamp: Date.now()
            });

            this.logger.info(`Venda completada: ID ${saleId}, Produto ${sale.product_id}, Valor R$ ${sale.amount}`);
            return true;

        } catch (error) {
            this.logger.error('Erro ao completar venda:', error);
            throw error;
        }
    }

    async getDigitalContent(productId, userId) {
        try {
            // Verificar se usuário comprou o produto
            const sale = await this.database.get(
                'SELECT * FROM sales WHERE user_id = ? AND product_id = ? AND status = "completed"',
                [userId, productId]
            );

            if (!sale) {
                throw new Error('Você não possui este produto ou a compra não foi confirmada.');
            }

            const product = await this.database.getProduct(productId);
            if (!product || !product.digital_content) {
                throw new Error('Conteúdo digital não disponível para este produto.');
            }

            // Descriptografar conteúdo
            const { SecurityManager } = require('../security/SecurityManager');
            const security = new SecurityManager();
            const decryptedContent = security.decrypt(product.digital_content);

            // Log do acesso ao conteúdo
            await this.database.logSecurityEvent('DIGITAL_CONTENT_ACCESSED', userId, {
                productId: productId,
                saleId: sale.id,
                timestamp: Date.now()
            });

            return {
                productName: product.name,
                content: decryptedContent
            };

        } catch (error) {
            this.logger.error('Erro ao obter conteúdo digital:', error);
            throw error;
        }
    }

    async getProductStats() {
        const products = Array.from(this.productsCache.values());
        const salesStats = await this.database.getSalesStats();

        return {
            totalProducts: products.length,
            activeProducts: products.filter(p => p.is_active).length,
            totalSales: salesStats.completed.count,
            totalRevenue: salesStats.completed.total,
            pendingSales: salesStats.pending,
            topSellingProducts: products
                .sort((a, b) => b.sales_count - a.sales_count)
                .slice(0, 5)
                .map(p => ({
                    name: p.name,
                    sales: p.sales_count,
                    revenue: p.sales_count * p.price
                }))
        };
    }

    async searchProducts(query) {
        const products = Array.from(this.productsCache.values());
        const searchTerm = query.toLowerCase();

        return products.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }

    getProduct(productId) {
        return this.productsCache.get(productId);
    }

    getAllProducts() {
        return Array.from(this.productsCache.values());
    }
}

module.exports = { ProductManager };
