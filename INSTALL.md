# 🚀 Guia de Instalação - Bot Discord de Tickets e Vendas

## 📋 Pré-requisitos

- Node.js 16.9.0 ou superior
- npm (vem com Node.js)
- Conta Discord Developer
- Servidor Discord com permissões de administrador

## 🛠️ Instalação Rápida

### 1. Clone o Repositório

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd discord-ticket-bot
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure o Ambiente

Copie o arquivo de exemplo e configure suas credenciais:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas informações:

```env
# Bot Discord
DISCORD_TOKEN=seu_token_do_bot_aqui
CLIENT_ID=id_do_cliente_do_bot
GUILD_ID=id_do_seu_servidor

# Segurança (GERE CHAVES ÚNICAS!)
BOT_SECRET_KEY=chave_secreta_super_forte_32_chars
ENCRYPTION_KEY=chave_criptografia_32_caracteres
ADMIN_USER_IDS=seu_user_id,outro_admin_id

# Canais (Configure após criar no Discord)
TICKET_CATEGORY_ID=id_categoria_tickets
PRODUCTS_CHANNEL_ID=id_canal_produtos
LOGS_CHANNEL_ID=id_canal_logs

# Webhook de Segurança (Opcional)
SECURITY_WEBHOOK_URL=url_webhook_logs
```

### 4. Registre os Comandos

```bash
node deploy-commands.js
```

### 5. Inicie o Bot

```bash
npm start
```

## 🔧 Configuração no Discord

### 1. Criar o Bot

1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Clique em "New Application"
3. Vá em "Bot" → "Add Bot"
4. Copie o token e coloque no `.env`

### 2. Configurar Permissões

O bot precisa das seguintes permissões:

- Gerenciar Canais
- Gerenciar Cargos
- Enviar Mensagens
- Incorporar Links
- Anexar Arquivos
- Ler Histórico de Mensagens
- Usar Emojis Externos
- Gerenciar Mensagens

### 3. Convidar o Bot

Use o link gerado no Discord Developer Portal com as permissões necessárias.

### 4. Configurar Canais

No seu servidor Discord:

1. Crie uma categoria para tickets
2. Crie um canal para produtos
3. Crie um canal para logs (opcional)
4. Copie os IDs e coloque no `.env`

### 5. Configuração Inicial

Execute no Discord:

```bash
/setup channels
/setup products
/setup permissions
/setup test
```

## 🛡️ Segurança

### Chaves de Criptografia

Gere chaves únicas de 32 caracteres:

```bash
# No Node.js
require('crypto').randomBytes(32).toString('hex')
```

### Variáveis Importantes

- **NUNCA** compartilhe o arquivo `.env`
- **NUNCA** commite tokens no Git
- Use IDs de usuários reais para ADMIN_USER_IDS
- Configure webhook de segurança para monitoramento

## 📊 Comandos Disponíveis

### Administrador

- `/admin stats` - Estatísticas do bot
- `/admin product create` - Criar produto
- `/admin blacklist add/remove` - Gerenciar blacklist
- `/admin cleanup` - Limpeza de dados

### Usuário

- `/user ticket` - Criar ticket
- `/user mytickets` - Ver tickets
- `/user mypurchases` - Ver compras
- `/user download` - Baixar produtos

## 🚨 Solução de Problemas

### Bot não responde

- Verifique o token no `.env`
- Confirme permissões do bot
- Execute `/setup permissions`

### Produtos não aparecem

- Verifique PRODUCTS_CHANNEL_ID
- Execute `/setup products`
- Confirme produtos ativos no banco

### Erros de permissão

- Verifique se o bot tem cargo com permissões
- Confirme se está na categoria correta
- Execute `/setup test`

## 📈 Monitoramento

### Logs

- `logs/bot-YYYY-MM-DD.log` - Logs gerais
- `logs/security-YYYY-MM-DD.log` - Logs de segurança

### Backup

O bot faz backup automático do banco de dados.
Recomenda-se backup manual de:

- `data/bot.db`
- Arquivo `.env` (sem versionar)

## 🔄 Atualizações

Para atualizar o bot:

```bash
git pull origin main
npm install
node deploy-commands.js
npm start
```

## 📞 Suporte

Em caso de problemas:

1. Verifique logs em `logs/`
2. Execute `/setup test`
3. Consulte `/admin security`

---

**⚠️ IMPORTANTE:** Mantenha suas chaves seguras e nunca as compartilhe!
