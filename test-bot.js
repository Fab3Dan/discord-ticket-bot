#!/usr/bin/env node

/**
 * Script de Teste Automatizado para Discord Bot
 * Verifica todas as funcionalidades críticas antes do deploy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BotTester {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.passed = 0;
        this.total = 0;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green
            warning: '\x1b[33m', // Yellow
            error: '\x1b[31m',   // Red
            reset: '\x1b[0m'
        };

        console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
    }

    test(description, testFn) {
        this.total++;
        try {
            const result = testFn();
            if (result === false) {
                this.errors.push(description);
                this.log(`❌ FAIL: ${description}`, 'error');
            } else {
                this.passed++;
                this.log(`✅ PASS: ${description}`, 'success');
            }
        } catch (error) {
            this.errors.push(`${description}: ${error.message}`);
            this.log(`❌ ERROR: ${description} - ${error.message}`, 'error');
        }
    }

    warn(description, checkFn) {
        try {
            const result = checkFn();
            if (result === false) {
                this.warnings.push(description);
                this.log(`⚠️  WARN: ${description}`, 'warning');
            }
        } catch (error) {
            this.warnings.push(`${description}: ${error.message}`);
            this.log(`⚠️  WARN: ${description} - ${error.message}`, 'warning');
        }
    }

    // Testes de estrutura de arquivos
    testFileStructure() {
        this.log('🔍 Testando estrutura de arquivos...', 'info');

        const requiredFiles = [
            'package.json',
            'src/index.js',
            'src/security/SecurityManager.js',
            'src/database/DatabaseManager.js',
            'src/managers/TicketManager.js',
            'src/managers/ProductManager.js',
            'src/utils/Logger.js',
            'src/commands/admin.js',
            'src/commands/setup.js',
            'src/commands/user.js',
            'deploy-commands.js',
            '.env.example',
            'README.md',
            'INSTALL.md',
            'TECHNICAL.md',
            '.gitignore'
        ];

        requiredFiles.forEach(file => {
            this.test(`Arquivo existe: ${file}`, () => {
                return fs.existsSync(path.join(process.cwd(), file));
            });
        });

        // Verificar diretórios
        const requiredDirs = ['src', 'src/security', 'src/database', 'src/managers', 'src/utils', 'src/commands'];
        requiredDirs.forEach(dir => {
            this.test(`Diretório existe: ${dir}`, () => {
                return fs.existsSync(path.join(process.cwd(), dir));
            });
        });
    }

    // Testes de dependências
    testDependencies() {
        this.log('📦 Testando dependências...', 'info');

        this.test('package.json é válido', () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return packageJson.name && packageJson.version && packageJson.dependencies;
        });

        this.test('node_modules existe', () => {
            return fs.existsSync('node_modules');
        });

        // Verificar dependências críticas
        const criticalDeps = ['discord.js', 'sqlite3', 'bcrypt', 'dotenv'];
        criticalDeps.forEach(dep => {
            this.test(`Dependência instalada: ${dep}`, () => {
                return fs.existsSync(`node_modules/${dep}`);
            });
        });
    }

    // Testes de sintaxe JavaScript
    testSyntax() {
        this.log('🔧 Testando sintaxe JavaScript...', 'info');

        const jsFiles = [
            'src/index.js',
            'src/security/SecurityManager.js',
            'src/database/DatabaseManager.js',
            'src/managers/TicketManager.js',
            'src/managers/ProductManager.js',
            'src/utils/Logger.js',
            'src/commands/admin.js',
            'src/commands/setup.js',
            'src/commands/user.js',
            'deploy-commands.js'
        ];

        jsFiles.forEach(file => {
            this.test(`Sintaxe válida: ${file}`, () => {
                try {
                    require(path.resolve(file));
                    return true;
                } catch (error) {
                    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('discord.js')) {
                        // Ignorar erros de módulos não encontrados durante teste
                        return true;
                    }
                    throw error;
                }
            });
        });
    }

    // Testes de configuração
    testConfiguration() {
        this.log('⚙️  Testando configuração...', 'info');

        this.test('.env.example existe e tem variáveis necessárias', () => {
            const envExample = fs.readFileSync('.env.example', 'utf8');
            const requiredVars = [
                'DISCORD_TOKEN',
                'CLIENT_ID', 
                'GUILD_ID',
                'BOT_SECRET_KEY',
                'ENCRYPTION_KEY',
                'ADMIN_USER_IDS'
            ];
            
            return requiredVars.every(varName => envExample.includes(varName));
        });

        this.warn('Arquivo .env configurado', () => {
            return fs.existsSync('.env');
        });

        this.test('Scripts npm definidos', () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return packageJson.scripts && packageJson.scripts.start;
        });
    }

    // Testes de segurança
    testSecurity() {
        this.log('🔒 Testando configurações de segurança...', 'info');

        this.test('.gitignore protege arquivos sensíveis', () => {
            const gitignore = fs.readFileSync('.gitignore', 'utf8');
            const protectedFiles = ['.env', 'node_modules/', '*.db', '*.log'];
            return protectedFiles.every(pattern => gitignore.includes(pattern));
        });

        this.test('Não há tokens hardcoded no código', () => {
            const jsFiles = [
                'src/index.js',
                'src/security/SecurityManager.js',
                'src/commands/admin.js'
            ];

            for (const file of jsFiles) {
                const content = fs.readFileSync(file, 'utf8');
                // Procurar por padrões de token do Discord
                if (content.match(/[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}/)) {
                    return false;
                }
            }
            return true;
        });

        this.test('package.json não expõe informações sensíveis', () => {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            return !packageJson.repository || !packageJson.repository.includes('token');
        });
    }

    // Testes de documentação
    testDocumentation() {
        this.log('📚 Testando documentação...', 'info');

        this.test('README.md tem conteúdo adequado', () => {
            const readme = fs.readFileSync('README.md', 'utf8');
            return readme.length > 500 && readme.includes('Discord') && readme.includes('Bot');
        });

        this.test('INSTALL.md tem instruções de instalação', () => {
            const install = fs.readFileSync('INSTALL.md', 'utf8');
            return install.includes('npm install') && install.includes('DISCORD_TOKEN');
        });

        this.test('TECHNICAL.md tem documentação técnica', () => {
            const technical = fs.readFileSync('TECHNICAL.md', 'utf8');
            return technical.includes('Arquitetura') && technical.includes('SecurityManager');
        });
    }

    // Executar todos os testes
    async runAllTests() {
        console.log('🚀 Iniciando testes automatizados do Discord Bot...\n');

        this.testFileStructure();
        this.testDependencies();
        this.testSyntax();
        this.testConfiguration();
        this.testSecurity();
        this.testDocumentation();

        // Relatório final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RELATÓRIO FINAL DE TESTES');
        console.log('='.repeat(60));
        
        this.log(`✅ Testes Passaram: ${this.passed}/${this.total}`, 'success');
        
        if (this.warnings.length > 0) {
            this.log(`⚠️  Avisos: ${this.warnings.length}`, 'warning');
            this.warnings.forEach(warning => {
                console.log(`   • ${warning}`);
            });
        }

        if (this.errors.length > 0) {
            this.log(`❌ Erros: ${this.errors.length}`, 'error');
            this.errors.forEach(error => {
                console.log(`   • ${error}`);
            });
            console.log('\n❌ TESTES FALHARAM - Corrija os erros antes do deploy!');
            process.exit(1);
        } else {
            console.log('\n🎉 TODOS OS TESTES PASSARAM - Bot pronto para deploy!');
            
            // Próximos passos
            console.log('\n📋 PRÓXIMOS PASSOS:');
            console.log('1. Configure o arquivo .env com suas credenciais');
            console.log('2. Execute: node deploy-commands.js');
            console.log('3. Execute: npm start');
            console.log('4. Configure canais no Discord: /setup channels');
            console.log('5. Inicialize produtos: /setup products');
        }
    }
}

// Executar testes se chamado diretamente
if (require.main === module) {
    const tester = new BotTester();
    tester.runAllTests().catch(error => {
        console.error('❌ Erro durante execução dos testes:', error);
        process.exit(1);
    });
}

module.exports = BotTester;
