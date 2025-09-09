const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { Logger } = require('../utils/Logger');

class SecurityManager {
    constructor() {
        this.logger = new Logger();
        this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateSecureKey();
        this.botSecretKey = process.env.BOT_SECRET_KEY || this.generateSecureKey();
        this.adminUserIds = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];
        
        // Rate limiters
        this.rateLimiters = {
            commands: new RateLimiterMemory({
                keyGenerator: (userId) => `cmd_${userId}`,
                points: parseInt(process.env.RATE_LIMIT_REQUESTS) || 5,
                duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
            }),
            tickets: new RateLimiterMemory({
                keyGenerator: (userId) => `ticket_${userId}`,
                points: 1,
                duration: 300000, // 5 minutos
            }),
            interactions: new RateLimiterMemory({
                keyGenerator: (userId) => `int_${userId}`,
                points: 10,
                duration: 60000,
            })
        };

        // Blacklist de usuários suspeitos
        this.blacklistedUsers = new Set();
        
        // Hash do código do bot para verificar integridade
        this.botCodeHash = this.generateBotHash();
        
        this.initializeSecurity();
    }

    async initializeSecurity() {
        // Verificar se as chaves de segurança estão configuradas
        if (!process.env.ENCRYPTION_KEY || !process.env.BOT_SECRET_KEY) {
            this.logger.warn('Chaves de segurança não configuradas! Gerando chaves temporárias...');
            this.logger.warn(`ENCRYPTION_KEY=${this.encryptionKey}`);
            this.logger.warn(`BOT_SECRET_KEY=${this.botSecretKey}`);
        }

        // Configurar monitoramento de integridade
        setInterval(() => {
            this.checkBotIntegrity();
        }, 300000); // Verificar a cada 5 minutos
    }

    generateSecureKey(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    generateBotHash() {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const indexPath = path.join(__dirname, '../index.js');
            const indexContent = fs.readFileSync(indexPath, 'utf8');
            return crypto.createHash('sha256').update(indexContent).digest('hex');
        } catch (error) {
            this.logger.error('Erro ao gerar hash do bot:', error);
            return null;
        }
    }

    async validateBotIntegrity() {
        const currentHash = this.generateBotHash();
        
        if (this.botCodeHash && currentHash !== this.botCodeHash) {
            await this.logSecurityEvent('BOT_INTEGRITY_VIOLATION', {
                originalHash: this.botCodeHash,
                currentHash: currentHash,
                timestamp: Date.now()
            });
            
            throw new Error('Integridade do bot comprometida! Possível modificação não autorizada detectada.');
        }
        
        return true;
    }

    async checkBotIntegrity() {
        try {
            await this.validateBotIntegrity();
        } catch (error) {
            this.logger.error('Verificação de integridade falhou:', error);
            // Em produção, você pode querer desligar o bot aqui
        }
    }

    encrypt(text) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            this.logger.error('Erro na criptografia:', error);
            throw error;
        }
    }

    decrypt(encryptedText) {
        try {
            const parts = encryptedText.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            this.logger.error('Erro na descriptografia:', error);
            throw error;
        }
    }

    async hashPassword(password) {
        return await bcrypt.hash(password, 12);
    }

    async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    async validateInteraction(interaction) {
        const userId = interaction.user.id;
        
        // Verificar se usuário está na blacklist
        if (this.blacklistedUsers.has(userId)) {
            await this.logSecurityEvent('BLACKLISTED_USER_ATTEMPT', {
                userId: userId,
                username: interaction.user.username,
                interactionType: interaction.type,
                timestamp: Date.now()
            });
            
            return { valid: false, reason: 'BLACKLISTED' };
        }

        // Verificar se é um bot
        if (interaction.user.bot) {
            await this.logSecurityEvent('BOT_INTERACTION_ATTEMPT', {
                userId: userId,
                username: interaction.user.username,
                timestamp: Date.now()
            });
            
            return { valid: false, reason: 'BOT_USER' };
        }

        // Verificar rate limiting
        try {
            await this.rateLimiters.interactions.consume(userId);
        } catch (rateLimitError) {
            await this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
                userId: userId,
                username: interaction.user.username,
                limiterType: 'interactions',
                timestamp: Date.now()
            });
            
            return { valid: false, reason: 'RATE_LIMITED' };
        }

        // Verificar padrões suspeitos
        const suspiciousCheck = await this.checkSuspiciousActivity(interaction);
        if (!suspiciousCheck.valid) {
            return suspiciousCheck;
        }

        return { valid: true };
    }

    async checkSuspiciousActivity(interaction) {
        const userId = interaction.user.id;
        const now = Date.now();
        
        // Verificar conta muito nova (menos de 7 dias)
        const accountAge = now - interaction.user.createdTimestamp;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        
        if (accountAge < sevenDays) {
            await this.logSecurityEvent('NEW_ACCOUNT_INTERACTION', {
                userId: userId,
                accountAge: accountAge,
                username: interaction.user.username,
                timestamp: now
            });
            
            // Permitir mas com monitoramento extra
        }

        // Verificar se o usuário tem avatar padrão (possível conta fake)
        if (!interaction.user.avatar) {
            await this.logSecurityEvent('DEFAULT_AVATAR_USER', {
                userId: userId,
                username: interaction.user.username,
                timestamp: now
            });
        }

        return { valid: true };
    }

    async checkRateLimit(userId, limiterType = 'commands') {
        try {
            const rateLimiter = this.rateLimiters[limiterType];
            if (!rateLimiter) {
                return { allowed: true };
            }

            await rateLimiter.consume(userId);
            return { allowed: true };
        } catch (rateLimitError) {
            const resetTime = Math.ceil(rateLimitError.msBeforeNext / 1000);
            
            await this.logSecurityEvent('RATE_LIMIT_HIT', {
                userId: userId,
                limiterType: limiterType,
                resetTime: resetTime,
                timestamp: Date.now()
            });
            
            return { 
                allowed: false, 
                resetTime: resetTime,
                remainingPoints: rateLimitError.remainingPoints 
            };
        }
    }

    async validateBotPermissions(client) {
        try {
            const guild = client.guilds.cache.get(process.env.GUILD_ID);
            if (!guild) {
                this.logger.warn('Guild não encontrada! Verifique o GUILD_ID.');
                return false;
            }

            const botMember = guild.members.cache.get(client.user.id);
            if (!botMember) {
                this.logger.warn('Bot não encontrado na guild.');
                return false;
            }

            const requiredPermissions = [
                'ManageChannels',
                'ManageRoles', 
                'SendMessages',
                'EmbedLinks',
                'AttachFiles',
                'ReadMessageHistory',
                'UseExternalEmojis'
            ];

            const missingPermissions = requiredPermissions.filter(
                perm => !botMember.permissions.has(perm)
            );

            if (missingPermissions.length > 0) {
                this.logger.warn(`Permissões faltando: ${missingPermissions.join(', ')}`);
                return false;
            }

            this.logger.info('Todas as permissões necessárias estão presentes.');
            return true;
        } catch (error) {
            this.logger.error('Erro ao validar permissões:', error);
            return false;
        }
    }

    async blacklistUser(userId, reason) {
        this.blacklistedUsers.add(userId);
        
        await this.logSecurityEvent('USER_BLACKLISTED', {
            userId: userId,
            reason: reason,
            timestamp: Date.now()
        });
        
        this.logger.warn(`Usuário ${userId} adicionado à blacklist: ${reason}`);
    }

    async removeFromBlacklist(userId) {
        this.blacklistedUsers.delete(userId);
        
        await this.logSecurityEvent('USER_REMOVED_FROM_BLACKLIST', {
            userId: userId,
            timestamp: Date.now()
        });
        
        this.logger.info(`Usuário ${userId} removido da blacklist.`);
    }

    isAdmin(userId) {
        return this.adminUserIds.includes(userId);
    }

    async logSecurityEvent(eventType, data) {
        const logEntry = {
            type: eventType,
            timestamp: Date.now(),
            data: data
        };

        this.logger.security(eventType, data);

        // Enviar para webhook se configurado
        if (process.env.SECURITY_WEBHOOK_URL) {
            try {
                const webhook = require('discord.js').WebhookClient({ url: process.env.SECURITY_WEBHOOK_URL });
                
                const embed = {
                    title: `🔒 Evento de Segurança: ${eventType}`,
                    description: `\`\`\`json\n${JSON.stringify(data, null, 2)}\`\`\``,
                    color: this.getEventColor(eventType),
                    timestamp: new Date().toISOString()
                };

                await webhook.send({ embeds: [embed] });
            } catch (error) {
                this.logger.error('Erro ao enviar log de segurança:', error);
            }
        }
    }

    getEventColor(eventType) {
        const colors = {
            'BOT_INTEGRITY_VIOLATION': 0xFF0000, // Vermelho
            'BLACKLISTED_USER_ATTEMPT': 0xFF4500, // Laranja vermelho
            'RATE_LIMIT_EXCEEDED': 0xFFA500, // Laranja
            'NEW_ACCOUNT_INTERACTION': 0xFFFF00, // Amarelo
            'DEFAULT_AVATAR_USER': 0x808080, // Cinza
            'USER_BLACKLISTED': 0x800080, // Roxo
            'BOT_INTERACTION_ATTEMPT': 0xFF69B4 // Rosa
        };
        
        return colors[eventType] || 0x0099FF; // Azul padrão
    }

    async logUserActivity(userId, activity, metadata = {}) {
        await this.logSecurityEvent('USER_ACTIVITY', {
            userId: userId,
            activity: activity,
            metadata: metadata,
            timestamp: Date.now()
        });
    }

    startSecurityMonitoring(client) {
        this.logger.info('Sistema de monitoramento de segurança iniciado.');
        
        // Monitorar mudanças no servidor
        client.on('guildMemberAdd', async (member) => {
            await this.logUserActivity(member.user.id, 'GUILD_JOIN', {
                guildId: member.guild.id,
                accountCreated: member.user.createdTimestamp
            });
        });

        client.on('guildMemberRemove', async (member) => {
            await this.logUserActivity(member.user.id, 'GUILD_LEAVE', {
                guildId: member.guild.id
            });
        });
    }

    generateSecureToken(data) {
        const timestamp = Date.now();
        const payload = JSON.stringify({ data, timestamp });
        const signature = crypto
            .createHmac('sha256', this.botSecretKey)
            .update(payload)
            .digest('hex');
        
        return Buffer.from(`${payload}.${signature}`).toString('base64');
    }

    verifySecureToken(token, maxAge = 3600000) { // 1 hora por padrão
        try {
            const decoded = Buffer.from(token, 'base64').toString('utf8');
            const [payload, signature] = decoded.split('.');
            
            // Verificar assinatura
            const expectedSignature = crypto
                .createHmac('sha256', this.botSecretKey)
                .update(payload)
                .digest('hex');
            
            if (signature !== expectedSignature) {
                throw new Error('Assinatura inválida');
            }

            const data = JSON.parse(payload);
            
            // Verificar idade do token
            if (Date.now() - data.timestamp > maxAge) {
                throw new Error('Token expirado');
            }

            return { valid: true, data: data.data };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

module.exports = { SecurityManager };
