const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configurar o sistema de tickets e produtos')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('channels')
                .setDescription('Configurar canais do sistema')
                .addChannelOption(option =>
                    option.setName('tickets_category')
                        .setDescription('Categoria para os tickets')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory))
                .addChannelOption(option =>
                    option.setName('products_channel')
                        .setDescription('Canal para exibir produtos')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText))
                .addChannelOption(option =>
                    option.setName('logs_channel')
                        .setDescription('Canal para logs de segurança')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('products')
                .setDescription('Inicializar sistema de produtos'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('permissions')
                .setDescription('Verificar permissões do bot'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Testar funcionalidades do sistema')),

    async execute(interaction) {
        const { SecurityManager } = require('../security/SecurityManager');
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
                case 'channels':
                    await this.setupChannels(interaction);
                    break;
                case 'products':
                    await this.setupProducts(interaction);
                    break;
                case 'permissions':
                    await this.checkPermissions(interaction);
                    break;
                case 'test':
                    await this.testSystem(interaction);
                    break;
            }
        } catch (error) {
            console.error('Erro no comando setup:', error);
            await interaction.reply({
                content: '❌ Erro interno. Verifique os logs.',
                ephemeral: true
            });
        }
    },

    async setupChannels(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const ticketsCategory = interaction.options.getChannel('tickets_category');
        const productsChannel = interaction.options.getChannel('products_channel');
        const logsChannel = interaction.options.getChannel('logs_channel');

        const { DatabaseManager } = require('../database/DatabaseManager');
        const database = new DatabaseManager();
        await database.initialize();

        try {
            // Salvar configurações no banco
            await database.setSetting('TICKET_CATEGORY_ID', ticketsCategory.id);
            await database.setSetting('PRODUCTS_CHANNEL_ID', productsChannel.id);
            
            if (logsChannel) {
                await database.setSetting('LOGS_CHANNEL_ID', logsChannel.id);
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Canais Configurados')
                .setColor(0x00FF00)
                .addFields(
                    {
                        name: '🎫 Categoria de Tickets',
                        value: `<#${ticketsCategory.id}>`,
                        inline: true
                    },
                    {
                        name: '🛍️ Canal de Produtos',
                        value: `<#${productsChannel.id}>`,
                        inline: true
                    }
                );

            if (logsChannel) {
                embed.addFields({
                    name: '📋 Canal de Logs',
                    value: `<#${logsChannel.id}>`,
                    inline: true
                });
            }

            embed.addFields({
                name: '📝 Próximos Passos',
                value: '1. Execute `/setup products` para inicializar os produtos\n2. Execute `/setup permissions` para verificar permissões\n3. Use `/admin product create` para adicionar produtos',
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao configurar canais: ${error.message}`
            });
        } finally {
            await database.close();
        }
    },

    async setupProducts(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const { DatabaseManager } = require('../database/DatabaseManager');
            const { ProductManager } = require('../managers/ProductManager');

            const database = new DatabaseManager();
            await database.initialize();

            const productManager = new ProductManager(interaction.client, database);
            await productManager.initializeProductSystem();

            await database.close();

            const embed = new EmbedBuilder()
                .setTitle('✅ Sistema de Produtos Inicializado')
                .setColor(0x00FF00)
                .setDescription(
                    'O sistema de produtos foi configurado com sucesso!\n\n' +
                    '**Funcionalidades ativas:**\n' +
                    '• Display automático de produtos\n' +
                    '• Sistema de tickets únicos por usuário\n' +
                    '• Criptografia de conteúdo digital\n' +
                    '• Controle de estoque\n' +
                    '• Logs de segurança\n\n' +
                    '**Para adicionar produtos:**\n' +
                    'Use o comando `/admin product create`'
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erro ao inicializar produtos: ${error.message}`
            });
        }
    },

    async checkPermissions(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const botMember = guild.members.cache.get(interaction.client.user.id);

        const requiredPermissions = [
            { name: 'Gerenciar Canais', permission: 'ManageChannels' },
            { name: 'Gerenciar Cargos', permission: 'ManageRoles' },
            { name: 'Enviar Mensagens', permission: 'SendMessages' },
            { name: 'Incorporar Links', permission: 'EmbedLinks' },
            { name: 'Anexar Arquivos', permission: 'AttachFiles' },
            { name: 'Ler Histórico', permission: 'ReadMessageHistory' },
            { name: 'Usar Emojis Externos', permission: 'UseExternalEmojis' },
            { name: 'Gerenciar Mensagens', permission: 'ManageMessages' }
        ];

        const embed = new EmbedBuilder()
            .setTitle('🔍 Verificação de Permissões')
            .setColor(0x0099FF);

        let allPermissionsOk = true;
        const permissionStatus = [];

        for (const perm of requiredPermissions) {
            const hasPermission = botMember.permissions.has(perm.permission);
            const status = hasPermission ? '✅' : '❌';
            
            permissionStatus.push(`${status} ${perm.name}`);
            
            if (!hasPermission) {
                allPermissionsOk = false;
            }
        }

        embed.setDescription(permissionStatus.join('\n'));

        if (allPermissionsOk) {
            embed.setColor(0x00FF00);
            embed.addFields({
                name: '✅ Status',
                value: 'Todas as permissões necessárias estão presentes!',
                inline: false
            });
        } else {
            embed.setColor(0xFF0000);
            embed.addFields({
                name: '⚠️ Ação Necessária',
                value: 'Algumas permissões estão faltando. Verifique as configurações do cargo do bot.',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    },

    async testSystem(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const tests = [];
        let allTestsPassed = true;

        try {
            // Teste 1: Conexão com banco de dados
            try {
                const { DatabaseManager } = require('../database/DatabaseManager');
                const database = new DatabaseManager();
                await database.initialize();
                await database.close();
                tests.push('✅ Conexão com banco de dados');
            } catch (error) {
                tests.push('❌ Conexão com banco de dados');
                allTestsPassed = false;
            }

            // Teste 2: Sistema de segurança
            try {
                const { SecurityManager } = require('../security/SecurityManager');
                const security = new SecurityManager();
                await security.validateBotIntegrity();
                tests.push('✅ Sistema de segurança');
            } catch (error) {
                tests.push('❌ Sistema de segurança');
                allTestsPassed = false;
            }

            // Teste 3: Verificar configurações
            try {
                const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
                const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
                
                if (missingVars.length === 0) {
                    tests.push('✅ Variáveis de ambiente');
                } else {
                    tests.push(`❌ Variáveis de ambiente (faltando: ${missingVars.join(', ')})`);
                    allTestsPassed = false;
                }
            } catch (error) {
                tests.push('❌ Variáveis de ambiente');
                allTestsPassed = false;
            }

            // Teste 4: Verificar canais configurados
            try {
                const { DatabaseManager } = require('../database/DatabaseManager');
                const database = new DatabaseManager();
                await database.initialize();
                
                const ticketCategoryId = await database.getSetting('TICKET_CATEGORY_ID');
                const productsChannelId = await database.getSetting('PRODUCTS_CHANNEL_ID');
                
                await database.close();

                if (ticketCategoryId && productsChannelId) {
                    const ticketCategory = interaction.guild.channels.cache.get(ticketCategoryId);
                    const productsChannel = interaction.guild.channels.cache.get(productsChannelId);
                    
                    if (ticketCategory && productsChannel) {
                        tests.push('✅ Canais configurados');
                    } else {
                        tests.push('❌ Canais configurados (canais não encontrados)');
                        allTestsPassed = false;
                    }
                } else {
                    tests.push('❌ Canais configurados (não configurados)');
                    allTestsPassed = false;
                }
            } catch (error) {
                tests.push('❌ Canais configurados');
                allTestsPassed = false;
            }

            // Teste 5: Sistema de criptografia
            try {
                const { SecurityManager } = require('../security/SecurityManager');
                const security = new SecurityManager();
                
                const testData = 'teste de criptografia';
                const encrypted = security.encrypt(testData);
                const decrypted = security.decrypt(encrypted);
                
                if (decrypted === testData) {
                    tests.push('✅ Sistema de criptografia');
                } else {
                    tests.push('❌ Sistema de criptografia');
                    allTestsPassed = false;
                }
            } catch (error) {
                tests.push('❌ Sistema de criptografia');
                allTestsPassed = false;
            }

        } catch (error) {
            tests.push('❌ Erro geral nos testes');
            allTestsPassed = false;
        }

        const embed = new EmbedBuilder()
            .setTitle('🧪 Teste do Sistema')
            .setDescription(tests.join('\n'))
            .setColor(allTestsPassed ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

        if (allTestsPassed) {
            embed.addFields({
                name: '🎉 Resultado',
                value: 'Todos os testes passaram! O sistema está funcionando corretamente.',
                inline: false
            });
        } else {
            embed.addFields({
                name: '⚠️ Resultado',
                value: 'Alguns testes falharam. Verifique a configuração do sistema.',
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
