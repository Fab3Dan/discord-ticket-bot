# 🤖 Bot de Discord - Sistema de Tickets e Vendas Digitais

Um bot de Discord completo e seguro para sistema de tickets únicos por usuário e venda de produtos digitais com até **30 slots** de produtos.

## 🚀 Funcionalidades

### 🎫 Sistema de Tickets

- **Tickets únicos por usuário** - Cada usuário pode ter apenas 1 ticket ativo
- **Criação automática de canais privados** com permissões específicas
- **Auto-fechamento por inatividade** (configurável)
- **Sistema de transcrições** para histórico
- **Controle de staff** com botões de ação

### 🛍️ Sistema de Produtos Digitais

- **30 slots para produtos** com imagens e preços
- **Interface visual com botões** para cada produto
- **Conteúdo digital criptografado** para segurança
- **Controle de estoque** (limitado ou ilimitado)
- **Entrega automática** após confirmação de pagamento

### 🔒 Segurança Avançada

- **Criptografia de conteúdo** com chaves únicas
- **Rate limiting** para prevenir spam
- **Blacklist de usuários** automática e manual
- **Logs de segurança** detalhados
- **Verificação de integridade** do bot
- **Proteção contra bots** e contas suspeitas

### 📊 Sistema de Monitoramento

- **Logs detalhados** de todas as ações
- **Webhook de segurança** para alertas
- **Estatísticas completas** de vendas e tickets
- **Limpeza automática** de dados antigos

## 📋 Pré-requisitos

- Node.js 16.9.0 ou superior
- Discord Bot Token
- Servidor Discord com permissões administrativas

## 🛠️ Instalação

1. **Clone o projeto:**

```bash
git clone <repository-url>
cd discord-ticket-bot
```

2. **Instale as dependências:**

```bash
npm install
```

3. **Configure as variáveis de ambiente:**

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Configurações do Bot Discord
DISCORD_TOKEN=MTQxNDgwMzgxMjUzNDg0OTU0Ng.GMydbA.mCP17dBGYW2Mx4fVpFovXtqkFU6awrDeiH84aE
CLIENT_ID=1414803812534849546
GUILD_ID=1348384072312815704

# Configurações de Segurança
BOT_SECRET_KEY=sua_chave_secreta_super_forte_aqui
ENCRYPTION_KEY=chave_de_criptografia_32_caracteres
ADMIN_USER_IDS=123456789,987654321

# Configurações de Canais
TICKET_CATEGORY_ID=id_da_categoria_tickets
PRODUCTS_CHANNEL_ID=id_do_canal_produtos
LOGS_CHANNEL_ID=id_do_canal_logs

# Webhook para Logs de Segurança (opcional)
SECURITY_WEBHOOK_URL=sua_webhook_url_aqui
```

4. **Registre os comandos:**

```bash
node deploy-commands.js
```

5. **Inicie o bot:**

```bash
npm start
```

## ⚙️ Configuração Inicial

### 1. Configurar Canais

```text
/setup channels
```

- Selecione a categoria para tickets
- Selecione o canal para produtos
- Opcionalmente, configure canal de logs

### 2. Inicializar Sistema de Produtos

```text
/setup products
```

### 3. Verificar Permissões

```text
/setup permissions
```

### 4. Testar Sistema

```text
/setup test
```

## 📝 Comandos Disponíveis

### 👑 Comandos de Administrador

#### `/admin stats`

Exibe estatísticas completas do bot (tickets, vendas, produtos)

#### `/admin product <ação>`

Gerenciar produtos:

- `create` - Criar novo produto
- `list` - Listar todos os produtos
- `edit` - Editar produto existente
- `delete` - Desativar produto

#### `/admin blacklist <ação> <usuário>`

Gerenciar blacklist de usuários

#### `/admin cleanup`

Limpeza de dados antigos e tickets órfãos

#### `/admin security`

Visualizar logs de segurança recentes

### 👤 Comandos de Usuário

#### `/user ticket`

Criar um ticket de suporte geral

#### `/user mytickets`

Ver histórico de seus tickets

#### `/user mypurchases`

Ver histórico de compras

#### `/user download <product_id>`

Baixar produto digital comprado

## 🔧 Estrutura do Projeto

```text
discord-ticket-bot/
├── src/
│   ├── index.js                 # Arquivo principal do bot
│   ├── commands/                # Comandos slash
│   │   ├── admin.js            # Comandos administrativos
│   │   ├── setup.js            # Comandos de configuração
│   │   └── user.js             # Comandos de usuário
│   ├── managers/               # Gerenciadores principais
│   │   ├── TicketManager.js    # Sistema de tickets
│   │   └── ProductManager.js   # Sistema de produtos
│   ├── security/               # Sistema de segurança
│   │   └── SecurityManager.js  # Criptografia e proteção
│   ├── database/               # Banco de dados
│   │   └── DatabaseManager.js  # SQLite com ORM customizado
│   └── utils/                  # Utilitários
│       └── Logger.js           # Sistema de logs
├── data/                       # Dados do bot
│   ├── bot.db                  # Banco de dados SQLite
│   ├── transcripts/            # Transcrições de tickets
│   └── downloads/              # Downloads temporários
├── logs/                       # Logs do sistema
├── package.json
├── deploy-commands.js          # Script para registrar comandos
└── README.md
```

## 🛡️ Recursos de Segurança

### Criptografia

- **Conteúdo digital criptografado** com AES-256-CBC
- **Chaves únicas** por instalação
- **Tokens seguros** com assinatura HMAC

### Proteção contra Abuso

- **Rate limiting** configurável por usuário
- **Blacklist automática** para comportamento suspeito
- **Verificação de contas novas** (menos de 7 dias)
- **Detecção de bots** automática

### Monitoramento

- **Logs de segurança** em tempo real
- **Webhook de alertas** para eventos críticos
- **Verificação de integridade** do código
- **Limpeza automática** de dados sensíveis

## 📊 Banco de Dados

O bot utiliza SQLite com as seguintes tabelas:

- `users` - Dados dos usuários
- `tickets` - Histórico de tickets
- `products` - Produtos digitais
- `sales` - Vendas e transações
- `security_logs` - Logs de segurança
- `settings` - Configurações do bot
- `user_sessions` - Sessões de usuário

## 🔄 Fluxo de Compra

1. **Usuário clica em produto** no canal de produtos
2. **Confirmação de compra** com embed detalhado
3. **Criação de ticket** exclusivo para a venda
4. **Staff processa pagamento** manualmente
5. **Confirmação via comando** `/admin sale complete`
6. **Entrega automática** do produto digital
7. **Fechamento do ticket** após conclusão

## 🚨 Troubleshooting

### Bot não responde

- Verifique se o token está correto
- Confirme as permissões do bot no servidor
- Execute `/setup permissions` para diagnóstico

### Produtos não aparecem

- Verifique se o canal de produtos está configurado
- Execute `/setup products` novamente
- Confirme se há produtos ativos no banco

### Tickets não são criados

- Verifique a categoria de tickets
- Confirme permissões do bot para criar canais
- Execute `/setup test` para diagnóstico completo

## 📈 Monitoramento e Manutenção

### Logs Importantes

- `logs/bot-YYYY-MM-DD.log` - Logs gerais
- `logs/security-YYYY-MM-DD.log` - Logs de segurança

### Limpeza Automática

O bot executa limpeza automática:

- **Logs antigos** (>30 dias)
- **Sessões expiradas**
- **Arquivos temporários**
- **Tickets órfãos**

### Backup

Recomenda-se backup regular de:

- `data/bot.db` - Banco de dados principal
- `logs/` - Logs de segurança
- `.env` - Configurações (sem versionar)

## 🤝 Suporte

Para suporte técnico:

1. Verifique os logs em `logs/`
2. Execute `/setup test` para diagnóstico
3. Consulte `/admin security` para eventos recentes

## 📄 Licença

Este projeto é privado e proprietário. Não distribuir sem autorização.

---

**⚠️ Importante:** Mantenha sempre suas chaves de segurança em local seguro e nunca as compartilhe. Este bot foi desenvolvido com foco em segurança máxima para proteger tanto o sistema quanto os usuários.
