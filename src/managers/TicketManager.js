const { 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const { Logger } = require('../utils/Logger');

class TicketManager {
    constructor(client, database) {
        this.client = client;
        this.database = database;
        this.logger = new Logger();
        this.activeTickets = new Map(); // Cache de tickets ativos
        this.ticketTimeouts = new Map(); // Timeouts para auto-close
    }

    async createTicket(interaction, productId = null) {
        const userId = interaction.user.id;
        const guild = interaction.guild;

        try {
            // Verificar se usuário já tem ticket ativo
            const existingTickets = await this.database.getUserActiveTickets(userId);
            if (existingTickets.length > 0) {
                const ticketChannel = guild.channels.cache.get(existingTickets[0].channel_id);
                const channelMention = ticketChannel ? `<#${ticketChannel.id}>` : 'canal não encontrado';
                
                return await interaction.reply({
                    content: `❌ Você já possui um ticket ativo: ${channelMention}`,
                    ephemeral: true
                });
            }

            // Criar usuário no banco se não existir
            await this.database.createUser({
                id: userId,
                username: interaction.user.username,
                discriminator: interaction.user.discriminator,
                avatar: interaction.user.avatar
            });

            // Obter categoria de tickets
            const categoryId = process.env.TICKET_CATEGORY_ID;
            const category = guild.channels.cache.get(categoryId);
            
            if (!category || category.type !== ChannelType.GuildCategory) {
                await interaction.reply({
                    content: '❌ Categoria de tickets não configurada. Use `/setup channels` primeiro.',
                    ephemeral: true
                });
                return null;
            }

            // Gerar nome único para o canal
            const ticketNumber = Date.now().toString().slice(-6);
            const channelName = `ticket-${interaction.user.username}-${ticketNumber}`.toLowerCase()
                .replace(/[^a-z0-9-]/g, '');

            // Criar canal do ticket
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    {
                        id: this.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles
                        ]
                    }
                ]
            });

            // Salvar ticket no banco de dados
            await this.database.createTicket({
                channelId: ticketChannel.id,
                userId: userId,
                productId: productId
            });

            // Adicionar ao cache
            this.activeTickets.set(ticketChannel.id, {
                userId: userId,
                productId: productId,
                createdAt: Date.now()
            });

            // Criar embed de boas-vindas
            const welcomeEmbed = await this.createWelcomeEmbed(interaction.user, productId);
            const actionRow = this.createTicketActionRow();

            await ticketChannel.send({
                content: `<@${userId}>`,
                embeds: [welcomeEmbed],
                components: [actionRow]
            });

            // Configurar auto-close timeout
            this.setTicketTimeout(ticketChannel.id);

            // Log da criação do ticket
            await this.database.logSecurityEvent('TICKET_CREATED', userId, {
                channelId: ticketChannel.id,
                productId: productId,
                timestamp: Date.now()
            });

            this.logger.info(`Ticket criado: ${ticketChannel.name} para usuário ${userId}`);

            // Responder à interação original
            await interaction.reply({
                content: `✅ Ticket criado com sucesso! <#${ticketChannel.id}>`,
                ephemeral: true
            });

            return ticketChannel;

        } catch (error) {
            this.logger.error('Erro ao criar ticket:', error);
            
            await interaction.reply({
                content: '❌ Erro interno ao criar ticket. Nossa equipe foi notificada.',
                ephemeral: true
            });
            
            throw error;
        }
    }

    async createWelcomeEmbed(user, productId = null) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket de Suporte')
            .setColor(0x00AE86)
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ 
                text: 'Sistema de Tickets Seguro', 
                iconURL: this.client.user.displayAvatarURL() 
            });

        if (productId) {
            const product = await this.database.getProduct(productId);
            if (product) {
                embed.setDescription(
                    `Olá <@${user.id}>! 👋\n\n` +
                    `Você demonstrou interesse no produto: **${product.name}**\n` +
                    `💰 Preço: R$ ${product.price.toFixed(2)}\n\n` +
                    `Nossa equipe entrará em contato em breve para auxiliá-lo com a compra.\n\n` +
                    `📋 **Informações importantes:**\n` +
                    `• Este ticket é único e exclusivo para você\n` +
                    `• Mantenha este canal privado\n` +
                    `• Não compartilhe informações pessoais desnecessárias\n` +
                    `• O ticket será fechado automaticamente após 24h de inatividade`
                );
                
                if (product.image_url) {
                    embed.setImage(product.image_url);
                }
            }
        } else {
            embed.setDescription(
                `Olá <@${user.id}>! 👋\n\n` +
                `Bem-vindo ao seu ticket de suporte exclusivo!\n\n` +
                `Nossa equipe entrará em contato em breve para auxiliá-lo.\n\n` +
                `📋 **Informações importantes:**\n` +
                `• Este ticket é único e exclusivo para você\n` +
                `• Mantenha este canal privado\n` +
                `• Descreva sua dúvida ou necessidade\n` +
                `• O ticket será fechado automaticamente após 24h de inatividade`
            );
        }

        return embed;
    }

    createTicketActionRow() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('🔒 Fechar Ticket')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_claim')
                    .setLabel('👤 Assumir Ticket')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_transcript')
                    .setLabel('📄 Gerar Transcrição')
                    .setStyle(ButtonStyle.Secondary)
            );
    }

    async handleTicketAction(interaction, params) {
        const [action] = params;
        const channelId = interaction.channel.id;

        try {
            switch (action) {
                case 'close':
                    await this.closeTicket(interaction);
                    break;
                case 'claim':
                    await this.claimTicket(interaction);
                    break;
                case 'transcript':
                    await this.generateTranscript(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Ação não reconhecida.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            this.logger.error(`Erro ao processar ação do ticket ${action}:`, error);
            await interaction.reply({
                content: '❌ Erro ao processar ação. Tente novamente.',
                ephemeral: true
            });
        }
    }

    async closeTicket(interaction) {
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;

        // Verificar se é um canal de ticket
        const ticket = await this.database.getTicket(channelId);
        if (!ticket) {
            return await interaction.reply({
                content: '❌ Este não é um canal de ticket válido.',
                ephemeral: true
            });
        }

        // Verificar permissões (dono do ticket ou staff)
        const isOwner = ticket.user_id === userId;
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
        
        if (!isOwner && !isStaff) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para fechar este ticket.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Gerar transcrição antes de fechar
            const transcript = await this.generateTicketTranscript(interaction.channel);
            
            // Criar embed de fechamento
            const closeEmbed = new EmbedBuilder()
                .setTitle('🔒 Ticket Fechado')
                .setDescription(
                    `Ticket fechado por: <@${userId}>\n` +
                    `Data: <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                    `Obrigado por utilizar nosso sistema de suporte!`
                )
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({
                embeds: [closeEmbed]
            });

            // Atualizar banco de dados
            await this.database.closeTicket(channelId, userId, 'Fechado pelo usuário');

            // Remover do cache
            this.activeTickets.delete(channelId);
            
            // Cancelar timeout se existir
            if (this.ticketTimeouts.has(channelId)) {
                clearTimeout(this.ticketTimeouts.get(channelId));
                this.ticketTimeouts.delete(channelId);
            }

            // Log do fechamento
            await this.database.logSecurityEvent('TICKET_CLOSED', userId, {
                channelId: channelId,
                closedBy: userId,
                timestamp: Date.now()
            });

            // Aguardar 10 segundos e deletar canal
            setTimeout(async () => {
                try {
                    await interaction.channel.delete('Ticket fechado');
                } catch (error) {
                    this.logger.error('Erro ao deletar canal do ticket:', error);
                }
            }, 10000);

        } catch (error) {
            this.logger.error('Erro ao fechar ticket:', error);
            await interaction.editReply({
                content: '❌ Erro ao fechar ticket. Tente novamente.'
            });
        }
    }

    async claimTicket(interaction) {
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;

        // Verificar se é staff
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return await interaction.reply({
                content: '❌ Apenas membros da equipe podem assumir tickets.',
                ephemeral: true
            });
        }

        const ticket = await this.database.getTicket(channelId);
        if (!ticket) {
            return await interaction.reply({
                content: '❌ Este não é um canal de ticket válido.',
                ephemeral: true
            });
        }

        const claimEmbed = new EmbedBuilder()
            .setTitle('👤 Ticket Assumido')
            .setDescription(
                `Este ticket foi assumido por <@${userId}>\n` +
                `Agora você será atendido por nossa equipe especializada.`
            )
            .setColor(0x00AE86)
            .setTimestamp();

        await interaction.reply({
            embeds: [claimEmbed]
        });

        // Log da ação
        await this.database.logSecurityEvent('TICKET_CLAIMED', userId, {
            channelId: channelId,
            staffId: userId,
            timestamp: Date.now()
        });
    }

    async generateTranscript(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const transcript = await this.generateTicketTranscript(interaction.channel);
            
            // Criar arquivo de transcrição
            const fs = require('fs');
            const path = require('path');
            
            const transcriptDir = './data/transcripts';
            if (!fs.existsSync(transcriptDir)) {
                fs.mkdirSync(transcriptDir, { recursive: true });
            }

            const fileName = `transcript-${interaction.channel.name}-${Date.now()}.txt`;
            const filePath = path.join(transcriptDir, fileName);
            
            fs.writeFileSync(filePath, transcript);

            await interaction.editReply({
                content: '✅ Transcrição gerada com sucesso!',
                files: [filePath]
            });

            // Log da ação
            await this.database.logSecurityEvent('TRANSCRIPT_GENERATED', interaction.user.id, {
                channelId: interaction.channel.id,
                fileName: fileName,
                timestamp: Date.now()
            });

        } catch (error) {
            this.logger.error('Erro ao gerar transcrição:', error);
            await interaction.editReply({
                content: '❌ Erro ao gerar transcrição.'
            });
        }
    }

    async generateTicketTranscript(channel) {
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        let transcript = `=== TRANSCRIÇÃO DO TICKET ===\n`;
        transcript += `Canal: ${channel.name}\n`;
        transcript += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
        transcript += `Total de mensagens: ${sortedMessages.size}\n`;
        transcript += `=====================================\n\n`;

        for (const message of sortedMessages.values()) {
            const timestamp = new Date(message.createdTimestamp).toLocaleString('pt-BR');
            const author = message.author.username;
            const content = message.content || '[Embed/Anexo]';
            
            transcript += `[${timestamp}] ${author}: ${content}\n`;
            
            if (message.embeds.length > 0) {
                transcript += `    [Embed: ${message.embeds[0].title || 'Sem título'}]\n`;
            }
            
            if (message.attachments.size > 0) {
                message.attachments.forEach(attachment => {
                    transcript += `    [Anexo: ${attachment.name}]\n`;
                });
            }
        }

        return transcript;
    }

    setTicketTimeout(channelId) {
        const timeoutHours = parseInt(process.env.TICKET_TIMEOUT_HOURS) || 24;
        const timeoutMs = timeoutHours * 60 * 60 * 1000;

        const timeout = setTimeout(async () => {
            try {
                const channel = this.client.channels.cache.get(channelId);
                if (!channel) return;

                const inactivityEmbed = new EmbedBuilder()
                    .setTitle('⏰ Ticket Fechado por Inatividade')
                    .setDescription(
                        `Este ticket foi fechado automaticamente devido à inatividade.\n` +
                        `Tempo limite: ${timeoutHours} horas\n\n` +
                        `Se precisar de ajuda, crie um novo ticket.`
                    )
                    .setColor(0xFFA500)
                    .setTimestamp();

                await channel.send({ embeds: [inactivityEmbed] });

                // Fechar ticket no banco
                await this.database.closeTicket(channelId, this.client.user.id, 'Fechado por inatividade');
                
                // Remover do cache
                this.activeTickets.delete(channelId);
                this.ticketTimeouts.delete(channelId);

                // Deletar canal após 30 segundos
                setTimeout(async () => {
                    try {
                        await channel.delete('Ticket fechado por inatividade');
                    } catch (error) {
                        this.logger.error('Erro ao deletar canal inativo:', error);
                    }
                }, 30000);

            } catch (error) {
                this.logger.error('Erro no timeout do ticket:', error);
            }
        }, timeoutMs);

        this.ticketTimeouts.set(channelId, timeout);
    }

    async getTicketStats() {
        return await this.database.getTicketStats();
    }

    async getUserTicketHistory(userId) {
        return await this.database.all(
            'SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
            [userId]
        );
    }

    // Método para limpar tickets órfãos (canais deletados mas ainda no banco)
    async cleanupOrphanedTickets() {
        const activeTickets = await this.database.all(
            'SELECT * FROM tickets WHERE status = "open"'
        );

        for (const ticket of activeTickets) {
            const channel = this.client.channels.cache.get(ticket.channel_id);
            if (!channel) {
                // Canal não existe mais, marcar como fechado
                await this.database.closeTicket(
                    ticket.channel_id, 
                    this.client.user.id, 
                    'Canal deletado manualmente'
                );
                
                this.logger.info(`Ticket órfão limpo: ${ticket.channel_id}`);
            }
        }
    }
}

module.exports = { TicketManager };
