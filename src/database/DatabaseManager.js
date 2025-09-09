const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { Logger } = require('../utils/Logger');

class DatabaseManager {
    constructor() {
        this.logger = new Logger();
        this.dbPath = process.env.DATABASE_PATH || './data/bot.db';
        this.db = null;
        
        // Criar diretório se não existir
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    this.logger.error('Erro ao conectar com o banco de dados:', err);
                    reject(err);
                } else {
                    this.logger.info('Conectado ao banco de dados SQLite.');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = [
            // Tabela de usuários
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                discriminator TEXT,
                avatar TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                is_blacklisted INTEGER DEFAULT 0,
                total_tickets INTEGER DEFAULT 0,
                total_purchases INTEGER DEFAULT 0
            )`,

            // Tabela de tickets
            `CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT UNIQUE NOT NULL,
                user_id TEXT NOT NULL,
                product_id INTEGER,
                status TEXT DEFAULT 'open',
                created_at INTEGER NOT NULL,
                closed_at INTEGER,
                closed_by TEXT,
                close_reason TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            )`,

            // Tabela de produtos
            `CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                image_url TEXT,
                digital_content TEXT,
                is_active INTEGER DEFAULT 1,
                stock_quantity INTEGER DEFAULT -1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                sales_count INTEGER DEFAULT 0
            )`,

            // Tabela de vendas
            `CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                ticket_id INTEGER,
                amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                payment_method TEXT,
                transaction_id TEXT,
                created_at INTEGER NOT NULL,
                completed_at INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (product_id) REFERENCES products (id),
                FOREIGN KEY (ticket_id) REFERENCES tickets (id)
            )`,

            // Tabela de logs de segurança
            `CREATE TABLE IF NOT EXISTS security_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                user_id TEXT,
                data TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at INTEGER NOT NULL
            )`,

            // Tabela de configurações
            `CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )`,

            // Tabela de sessões de usuário
            `CREATE TABLE IF NOT EXISTS user_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                data TEXT,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`
        ];

        for (const tableSQL of tables) {
            await this.run(tableSQL);
        }

        // Criar índices para melhor performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status)',
            'CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status)',
            'CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs (event_type)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at)'
        ];

        for (const indexSQL of indexes) {
            await this.run(indexSQL);
        }

        await this.insertDefaultData();
        this.logger.info('Tabelas do banco de dados criadas/verificadas com sucesso.');
    }

    async insertDefaultData() {
        // Inserir configurações padrão
        const defaultSettings = [
            { key: 'max_tickets_per_user', value: '1' },
            { key: 'ticket_timeout_hours', value: '24' },
            { key: 'auto_close_inactive_tickets', value: 'true' },
            { key: 'require_payment_confirmation', value: 'true' },
            { key: 'bot_version', value: '1.0.0' }
        ];

        for (const setting of defaultSettings) {
            await this.run(
                'INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                [setting.key, setting.value, Date.now()]
            );
        }

        // Inserir produtos de exemplo (você pode remover isso em produção)
        const sampleProducts = [
            {
                name: 'Produto Digital 1',
                description: 'Descrição do produto digital 1',
                price: 29.99,
                image_url: 'https://via.placeholder.com/300x200?text=Produto+1',
                digital_content: 'Conteúdo digital criptografado aqui...'
            },
            {
                name: 'Produto Digital 2',
                description: 'Descrição do produto digital 2',
                price: 49.99,
                image_url: 'https://via.placeholder.com/300x200?text=Produto+2',
                digital_content: 'Conteúdo digital criptografado aqui...'
            }
        ];

        for (const product of sampleProducts) {
            await this.run(
                `INSERT OR IGNORE INTO products 
                (name, description, price, image_url, digital_content, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    product.name,
                    product.description,
                    product.price,
                    product.image_url,
                    product.digital_content,
                    Date.now(),
                    Date.now()
                ]
            );
        }
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Métodos específicos para usuários
    async createUser(userData) {
        const now = Date.now();
        return await this.run(
            `INSERT OR REPLACE INTO users 
            (id, username, discriminator, avatar, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userData.id,
                userData.username,
                userData.discriminator || '0000',
                userData.avatar,
                now,
                now
            ]
        );
    }

    async getUser(userId) {
        return await this.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    async updateUser(userId, updates) {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), Date.now(), userId];
        
        return await this.run(
            `UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`,
            values
        );
    }

    // Métodos específicos para tickets
    async createTicket(ticketData) {
        return await this.run(
            `INSERT INTO tickets 
            (channel_id, user_id, product_id, status, created_at) 
            VALUES (?, ?, ?, ?, ?)`,
            [
                ticketData.channelId,
                ticketData.userId,
                ticketData.productId || null,
                'open',
                Date.now()
            ]
        );
    }

    async getTicket(channelId) {
        return await this.get('SELECT * FROM tickets WHERE channel_id = ?', [channelId]);
    }

    async getUserActiveTickets(userId) {
        return await this.all(
            'SELECT * FROM tickets WHERE user_id = ? AND status = "open"',
            [userId]
        );
    }

    async closeTicket(channelId, closedBy, reason = null) {
        return await this.run(
            `UPDATE tickets 
            SET status = 'closed', closed_at = ?, closed_by = ?, close_reason = ? 
            WHERE channel_id = ?`,
            [Date.now(), closedBy, reason, channelId]
        );
    }

    async getTicketStats() {
        const totalTickets = await this.get('SELECT COUNT(*) as count FROM tickets');
        const openTickets = await this.get('SELECT COUNT(*) as count FROM tickets WHERE status = "open"');
        const closedTickets = await this.get('SELECT COUNT(*) as count FROM tickets WHERE status = "closed"');
        
        return {
            total: totalTickets.count,
            open: openTickets.count,
            closed: closedTickets.count
        };
    }

    // Métodos específicos para produtos
    async getProducts(activeOnly = true) {
        const sql = activeOnly 
            ? 'SELECT * FROM products WHERE is_active = 1 ORDER BY id'
            : 'SELECT * FROM products ORDER BY id';
        return await this.all(sql);
    }

    async getProduct(productId) {
        return await this.get('SELECT * FROM products WHERE id = ?', [productId]);
    }

    async createProduct(productData) {
        const now = Date.now();
        return await this.run(
            `INSERT INTO products 
            (name, description, price, image_url, digital_content, stock_quantity, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                productData.name,
                productData.description,
                productData.price,
                productData.imageUrl,
                productData.digitalContent,
                productData.stockQuantity || -1,
                now,
                now
            ]
        );
    }

    async updateProduct(productId, updates) {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), Date.now(), productId];
        
        return await this.run(
            `UPDATE products SET ${setClause}, updated_at = ? WHERE id = ?`,
            values
        );
    }

    async incrementProductSales(productId) {
        return await this.run(
            'UPDATE products SET sales_count = sales_count + 1 WHERE id = ?',
            [productId]
        );
    }

    // Métodos específicos para vendas
    async createSale(saleData) {
        return await this.run(
            `INSERT INTO sales 
            (user_id, product_id, ticket_id, amount, status, payment_method, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                saleData.userId,
                saleData.productId,
                saleData.ticketId || null,
                saleData.amount,
                saleData.status || 'pending',
                saleData.paymentMethod || null,
                Date.now()
            ]
        );
    }

    async updateSale(saleId, updates) {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), saleId];
        
        return await this.run(
            `UPDATE sales SET ${setClause} WHERE id = ?`,
            values
        );
    }

    async getUserSales(userId) {
        return await this.all(
            `SELECT s.*, p.name as product_name 
            FROM sales s 
            JOIN products p ON s.product_id = p.id 
            WHERE s.user_id = ? 
            ORDER BY s.created_at DESC`,
            [userId]
        );
    }

    async getSalesStats() {
        const totalSales = await this.get('SELECT COUNT(*) as count, SUM(amount) as total FROM sales WHERE status = "completed"');
        const pendingSales = await this.get('SELECT COUNT(*) as count FROM sales WHERE status = "pending"');
        
        return {
            completed: {
                count: totalSales.count || 0,
                total: totalSales.total || 0
            },
            pending: pendingSales.count || 0
        };
    }

    // Métodos para logs de segurança
    async logSecurityEvent(eventType, userId, data, ipAddress = null, userAgent = null) {
        return await this.run(
            `INSERT INTO security_logs 
            (event_type, user_id, data, ip_address, user_agent, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                eventType,
                userId,
                JSON.stringify(data),
                ipAddress,
                userAgent,
                Date.now()
            ]
        );
    }

    async getSecurityLogs(limit = 100, eventType = null) {
        const sql = eventType 
            ? 'SELECT * FROM security_logs WHERE event_type = ? ORDER BY created_at DESC LIMIT ?'
            : 'SELECT * FROM security_logs ORDER BY created_at DESC LIMIT ?';
        
        const params = eventType ? [eventType, limit] : [limit];
        return await this.all(sql, params);
    }

    // Métodos para configurações
    async getSetting(key) {
        const result = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
        return result ? result.value : null;
    }

    async setSetting(key, value) {
        return await this.run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
            [key, value, Date.now()]
        );
    }

    // Limpeza de dados antigos
    async cleanupOldData() {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        // Limpar logs de segurança antigos
        await this.run(
            'DELETE FROM security_logs WHERE created_at < ?',
            [thirtyDaysAgo]
        );

        // Limpar sessões expiradas
        await this.run(
            'DELETE FROM user_sessions WHERE expires_at < ?',
            [Date.now()]
        );

        this.logger.info('Limpeza de dados antigos concluída.');
    }

    async close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    this.logger.error('Erro ao fechar banco de dados:', err);
                } else {
                    this.logger.info('Conexão com banco de dados fechada.');
                }
                resolve();
            });
        });
    }
}

module.exports = { DatabaseManager };
