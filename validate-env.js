#!/usr/bin/env node

/**
 * Validador de Ambiente para Discord Bot
 * Verifica se todas as variáveis de ambiente estão configuradas corretamente
 */

const fs = require('fs');
const path = require('path');

class EnvironmentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.requiredVars = [
            'DISCORD_TOKEN',
            'CLIENT_ID',
            'GUILD_ID',
            'BOT_SECRET_KEY',
            'ENCRYPTION_KEY',
            'ADMIN_USER_IDS'
        ];
        this.optionalVars = [
            'TICKET_CATEGORY_ID',
            'PRODUCTS_CHANNEL_ID',
            'LOGS_CHANNEL_ID',
            'SECURITY_WEBHOOK_URL',
            'RATE_LIMIT_REQUESTS',
            'RATE_LIMIT_WINDOW_MS',
            'TICKET_TIMEOUT_HOURS'
        ];
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            warning: '\x1b[33m',
            error: '\x1b[31m',
            reset: '\x1b[0m'
        };
        console.log(`${colors[type]}${message}${colors.reset}`);
    }

    validateEnvFile() {
        if (!fs.existsSync('.env')) {
            this.errors.push('Arquivo .env não encontrado');
            return false;
        }

        try {
            require('dotenv').config();
            return true;
        } catch (error) {
            this.errors.push(`Erro ao carregar .env: ${error.message}`);
            return false;
        }
    }

    validateRequiredVars() {
        this.requiredVars.forEach(varName => {
            const value = process.env[varName];
            
            if (!value) {
                this.errors.push(`Variável obrigatória não definida: ${varName}`);
                return;
            }

            // Validações específicas
            switch (varName) {
                case 'DISCORD_TOKEN':
                    if (!this.validateDiscordToken(value)) {
                        this.errors.push('DISCORD_TOKEN inválido (formato incorreto)');
                    }
                    break;
                
                case 'CLIENT_ID':
                case 'GUILD_ID':
                    if (!this.validateSnowflake(value)) {
                        this.errors.push(`${varName} deve ser um ID Discord válido (números)`);
                    }
                    break;
                
                case 'BOT_SECRET_KEY':
                case 'ENCRYPTION_KEY':
                    if (value.length < 32) {
                        this.errors.push(`${varName} deve ter pelo menos 32 caracteres`);
                    }
                    break;
                
                case 'ADMIN_USER_IDS':
                    if (!this.validateAdminIds(value)) {
                        this.errors.push('ADMIN_USER_IDS deve conter IDs válidos separados por vírgula');
                    }
                    break;
            }
        });
    }

    validateOptionalVars() {
        this.optionalVars.forEach(varName => {
            const value = process.env[varName];
            
            if (!value) {
                this.warnings.push(`Variável opcional não definida: ${varName}`);
                return;
            }

            // Validações específicas para opcionais
            switch (varName) {
                case 'TICKET_CATEGORY_ID':
                case 'PRODUCTS_CHANNEL_ID':
                case 'LOGS_CHANNEL_ID':
                    if (!this.validateSnowflake(value)) {
                        this.warnings.push(`${varName} deve ser um ID Discord válido`);
                    }
                    break;
                
                case 'SECURITY_WEBHOOK_URL':
                    if (!this.validateWebhookUrl(value)) {
                        this.warnings.push('SECURITY_WEBHOOK_URL deve ser uma URL válida do Discord');
                    }
                    break;
                
                case 'RATE_LIMIT_REQUESTS':
                case 'RATE_LIMIT_WINDOW_MS':
                case 'TICKET_TIMEOUT_HOURS':
                    if (isNaN(parseInt(value)) || parseInt(value) <= 0) {
                        this.warnings.push(`${varName} deve ser um número positivo`);
                    }
                    break;
            }
        });
    }

    validateDiscordToken(token) {
        // Formato básico do token Discord: MTxxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxx
        return /^[A-Za-z0-9+/]{24,28}\.[A-Za-z0-9+/]{6}\.[A-Za-z0-9+/._-]{27,}$/.test(token);
    }

    validateSnowflake(id) {
        // Discord Snowflakes são números de 17-19 dígitos
        return /^\d{17,19}$/.test(id);
    }

    validateAdminIds(ids) {
        const idList = ids.split(',').map(id => id.trim());
        return idList.every(id => this.validateSnowflake(id));
    }

    validateWebhookUrl(url) {
        return url.startsWith('https://discord.com/api/webhooks/') || 
               url.startsWith('https://discordapp.com/api/webhooks/');
    }

    checkSecurityKeys() {
        const botSecret = process.env.BOT_SECRET_KEY;
        const encryptionKey = process.env.ENCRYPTION_KEY;

        if (botSecret && encryptionKey && botSecret === encryptionKey) {
            this.warnings.push('BOT_SECRET_KEY e ENCRYPTION_KEY são iguais - use chaves diferentes para maior segurança');
        }

        // Verificar se as chaves não são valores de exemplo
        const exampleKeys = [
            'chave_secreta_super_forte_32_chars',
            'chave_criptografia_32_caracteres',
            'your_secret_key_here',
            'your_encryption_key_here'
        ];

        if (botSecret && exampleKeys.includes(botSecret)) {
            this.errors.push('BOT_SECRET_KEY ainda está usando valor de exemplo - gere uma chave única');
        }

        if (encryptionKey && exampleKeys.includes(encryptionKey)) {
            this.errors.push('ENCRYPTION_KEY ainda está usando valor de exemplo - gere uma chave única');
        }
    }

    generateSecureKeys() {
        const crypto = require('crypto');
        
        this.log('\n🔑 Chaves de segurança geradas:', 'info');
        this.log(`BOT_SECRET_KEY=${crypto.randomBytes(32).toString('hex')}`, 'success');
        this.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`, 'success');
        this.log('\n💡 Copie essas chaves para seu arquivo .env', 'warning');
    }

    async validate() {
        this.log('🔍 Validando configuração do ambiente...', 'info');

        // Verificar se .env existe
        if (!this.validateEnvFile()) {
            this.log('\n❌ Arquivo .env não encontrado ou inválido', 'error');
            this.log('📋 Copie .env.example para .env e configure as variáveis', 'info');
            return false;
        }

        // Validar variáveis obrigatórias
        this.validateRequiredVars();

        // Validar variáveis opcionais
        this.validateOptionalVars();

        // Verificar segurança das chaves
        this.checkSecurityKeys();

        // Relatório
        console.log('\n' + '='.repeat(50));
        console.log('📊 RELATÓRIO DE VALIDAÇÃO');
        console.log('='.repeat(50));

        if (this.errors.length === 0) {
            this.log('✅ Todas as variáveis obrigatórias estão configuradas', 'success');
        } else {
            this.log(`❌ ${this.errors.length} erro(s) encontrado(s):`, 'error');
            this.errors.forEach(error => console.log(`   • ${error}`));
        }

        if (this.warnings.length > 0) {
            this.log(`⚠️  ${this.warnings.length} aviso(s):`, 'warning');
            this.warnings.forEach(warning => console.log(`   • ${warning}`));
        }

        if (this.errors.length === 0) {
            this.log('\n🎉 Configuração válida! Bot pronto para iniciar.', 'success');
            return true;
        } else {
            this.log('\n❌ Corrija os erros antes de iniciar o bot.', 'error');
            
            // Oferecer ajuda para gerar chaves
            if (this.errors.some(error => error.includes('chave'))) {
                this.log('\n🔧 Precisa de chaves seguras? Execute:', 'info');
                this.log('node validate-env.js --generate-keys', 'info');
            }
            
            return false;
        }
    }
}

// Executar validação
if (require.main === module) {
    const validator = new EnvironmentValidator();
    
    // Verificar se deve gerar chaves
    if (process.argv.includes('--generate-keys')) {
        validator.generateSecureKeys();
        process.exit(0);
    }
    
    validator.validate().then(isValid => {
        process.exit(isValid ? 0 : 1);
    }).catch(error => {
        console.error('❌ Erro durante validação:', error);
        process.exit(1);
    });
}

module.exports = EnvironmentValidator;
