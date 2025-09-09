const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const { SecurityManager } = require('./security/SecurityManager');
const { DatabaseManager } = require('./database/DatabaseManager');
const { TicketManager } = require('./managers/TicketManager');
const { ProductManager } = require('./managers/ProductManager');
const { Logger } = require('./utils/Logger');
require('dotenv').config();

class SecureTicketBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.commands = new Collection();
        this.security = new SecurityManager();
        this.database = new DatabaseManager();
        this.ticketManager = new TicketManager(this.client, this.database);
        this.productManager = new ProductManager(this.client, this.database);
        this.logger = new Logger();

        this.initializeBot();
    }

    async initializeBot() {
        try {
            // Verificar integridade do sistema
            await this.security.validateBotIntegrity();
            
            // Inicializar banco de dados
            await this.database.initialize();
            
            // Registrar eventos
            this.registerEvents();
            
            // Carregar comandos
            await this.loadCommands();
            
            // Login do bot
            await this.client.login(process.env.DISCORD_TOKEN);
            
            this.logger.info('Bot iniciado com sucesso!');
        } catch (error) {
            this.logger.error('Erro ao inicializar bot:', error);
            process.exit(1);
        }
    }

    registerEvents() {
        this.client.once(Events.ClientReady, async () => {
            this.logger.info(`Bot logado como ${this.client.user.tag}`);
            
            // Verificar permissões e configurações
            await this.security.validateBotPermissions(this.client);
            
            // Inicializar sistema de produtos
            await this.productManager.initializeProductSystem();
            
            // Configurar monitoramento de segurança
            this.security.startSecurityMonitoring(this.client);
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                // Verificar segurança da interação
                const securityCheck = await this.security.validateInteraction(interaction);
                if (!securityCheck.valid) {
                    await interaction.reply({ 
                        content: '❌ Acesso negado por motivos de segurança.', 
                        ephemeral: true 
                    });
                    return;
                }

                if (interaction.isChatInputCommand()) {
                    await this.handleSlashCommand(interaction);
                } else if (interaction.isButton()) {
                    await this.handleButtonInteraction(interaction);
                } else if (interaction.isSelectMenu()) {
                    await this.handleSelectMenuInteraction(interaction);
                }
            } catch (error) {
                this.logger.error('Erro ao processar interação:', error);
                await this.handleInteractionError(interaction, error);
            }
        });

        this.client.on(Events.GuildMemberAdd, async (member) => {
            await this.security.logUserActivity(member.user.id, 'MEMBER_JOIN', {
                guild: member.guild.id,
                timestamp: Date.now()
            });
        });

        this.client.on(Events.Error, (error) => {
            this.logger.error('Erro do cliente Discord:', error);
        });
    }

    async handleSlashCommand(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        // Rate limiting por usuário
        const rateLimitCheck = await this.security.checkRateLimit(interaction.user.id);
        if (!rateLimitCheck.allowed) {
            await interaction.reply({
                content: `❌ Muitas tentativas. Tente novamente em ${rateLimitCheck.resetTime}s.`,
                ephemeral: true
            });
            return;
        }

        await command.execute(interaction);
    }

    async handleButtonInteraction(interaction) {
        const [action, ...params] = interaction.customId.split('_');

        switch (action) {
            case 'product':
                await this.productManager.handleProductPurchase(interaction, params[0]);
                break;
            case 'ticket':
                await this.ticketManager.handleTicketAction(interaction, params);
                break;
            case 'close':
                await this.ticketManager.closeTicket(interaction);
                break;
            default:
                await interaction.reply({ 
                    content: '❌ Ação não reconhecida.', 
                    ephemeral: true 
                });
        }
    }

    async handleSelectMenuInteraction(interaction) {
        // Implementar lógica para select menus se necessário
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({ content: 'Funcionalidade em desenvolvimento.' });
    }

    async handleInteractionError(interaction, error) {
        const errorMessage = 'Ocorreu um erro interno. Nossa equipe foi notificada.';
        
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ ${errorMessage}` });
            } else {
                await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
            }
        } catch (followUpError) {
            this.logger.error('Erro ao enviar mensagem de erro:', followUpError);
        }

        // Log detalhado do erro
        await this.security.logSecurityEvent('INTERACTION_ERROR', {
            userId: interaction.user.id,
            commandName: interaction.commandName || interaction.customId,
            error: error.message,
            timestamp: Date.now()
        });
    }

    async loadCommands() {
        const fs = require('fs');
        const path = require('path');
        
        const commandsPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(commandsPath)) return;

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
            }
        }
    }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Inicializar bot
new SecureTicketBot();
