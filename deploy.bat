@echo off
REM Script de Deploy Automático para Bot Discord (Windows)
REM Autor: Sistema Automatizado
REM Versão: 1.0

echo 🚀 Iniciando deploy do Bot Discord...

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado. Instale Node.js 16.9.0 ou superior.
    pause
    exit /b 1
)

REM Verificar se npm está instalado
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm não encontrado. Instale npm.
    pause
    exit /b 1
)

echo ✅ Node.js e npm encontrados.

REM Instalar dependências
echo 📦 Instalando dependências...
npm install

if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências.
    pause
    exit /b 1
)

echo ✅ Dependências instaladas com sucesso.

REM Verificar se arquivo .env existe
if not exist ".env" (
    echo ⚠️  Arquivo .env não encontrado.
    echo 📋 Copiando .env.example para .env...
    copy .env.example .env
    echo 🔧 Configure o arquivo .env com suas credenciais antes de continuar.
    echo 📝 Edite o arquivo .env e execute este script novamente.
    pause
    exit /b 1
)

echo ✅ Arquivo .env encontrado.

REM Criar diretórios necessários
echo 📁 Criando diretórios necessários...
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "data\transcripts" mkdir data\transcripts
if not exist "data\downloads" mkdir data\downloads

echo ✅ Diretórios criados.

REM Registrar comandos no Discord
echo 🔧 Registrando comandos no Discord...
node deploy-commands.js

if %errorlevel% neq 0 (
    echo ❌ Erro ao registrar comandos. Verifique suas credenciais no .env.
    pause
    exit /b 1
)

echo ✅ Comandos registrados com sucesso.

REM Verificar se PM2 está instalado
pm2 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 🔄 PM2 encontrado. Iniciando com PM2...
    pm2 start src/index.js --name "discord-ticket-bot"
    pm2 save
    echo ✅ Bot iniciado com PM2.
) else (
    echo ⚠️  PM2 não encontrado. Iniciando em modo desenvolvimento...
    echo 💡 Para produção, instale PM2: npm install -g pm2
    npm start
)

echo 🎉 Deploy concluído com sucesso!
echo.
echo 📋 Próximos passos:
echo 1. Configure os canais no Discord: /setup channels
echo 2. Inicialize os produtos: /setup products
echo 3. Verifique permissões: /setup permissions
echo 4. Teste o sistema: /setup test
echo.
echo 📊 Monitoramento:
echo - Logs: .\logs\
echo - Banco de dados: .\data\bot.db
echo - Status: /admin stats

pause
