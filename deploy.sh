#!/bin/bash

# Script de Deploy Automático para Bot Discord
# Autor: Sistema Automatizado
# Versão: 1.0

echo "🚀 Iniciando deploy do Bot Discord..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 16.9.0 ou superior."
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Instale npm."
    exit 1
fi

echo "✅ Node.js e npm encontrados."

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências."
    exit 1
fi

echo "✅ Dependências instaladas com sucesso."

# Verificar se arquivo .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado."
    echo "📋 Copiando .env.example para .env..."
    cp .env.example .env
    echo "🔧 Configure o arquivo .env com suas credenciais antes de continuar."
    echo "📝 Edite o arquivo .env e execute este script novamente."
    exit 1
fi

echo "✅ Arquivo .env encontrado."

# Criar diretórios necessários
echo "📁 Criando diretórios necessários..."
mkdir -p data
mkdir -p logs
mkdir -p data/transcripts
mkdir -p data/downloads

echo "✅ Diretórios criados."

# Verificar se comandos devem ser registrados
echo "🔧 Registrando comandos no Discord..."
node deploy-commands.js

if [ $? -ne 0 ]; then
    echo "❌ Erro ao registrar comandos. Verifique suas credenciais no .env."
    exit 1
fi

echo "✅ Comandos registrados com sucesso."

# Verificar se PM2 está instalado (para produção)
if command -v pm2 &> /dev/null; then
    echo "🔄 PM2 encontrado. Iniciando com PM2..."
    pm2 start src/index.js --name "discord-ticket-bot"
    pm2 save
    echo "✅ Bot iniciado com PM2."
else
    echo "⚠️  PM2 não encontrado. Iniciando em modo desenvolvimento..."
    echo "💡 Para produção, instale PM2: npm install -g pm2"
    npm start
fi

echo "🎉 Deploy concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure os canais no Discord: /setup channels"
echo "2. Inicialize os produtos: /setup products"
echo "3. Verifique permissões: /setup permissions"
echo "4. Teste o sistema: /setup test"
echo ""
echo "📊 Monitoramento:"
echo "- Logs: ./logs/"
echo "- Banco de dados: ./data/bot.db"
echo "- Status: /admin stats"
