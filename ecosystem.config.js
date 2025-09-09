module.exports = {
  apps: [{
    name: 'discord-ticket-bot',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Variáveis de ambiente para produção
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Configurações de log
    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Configurações de monitoramento
    monitoring: false,
    
    // Configurações de cluster (se necessário no futuro)
    // instances: 'max',
    // exec_mode: 'cluster'
  }]
};
