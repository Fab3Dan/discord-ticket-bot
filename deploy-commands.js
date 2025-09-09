const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

// Carregar todos os comandos
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ Comando carregado: ${command.data.name}`);
    } else {
        console.log(`⚠️ Comando em ${filePath} está faltando "data" ou "execute".`);
    }
}

// Registrar comandos
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🔄 Iniciando registro de ${commands.length} comandos...`);

        // Registrar comandos globalmente ou no servidor específico
        const data = await rest.put(
            process.env.GUILD_ID 
                ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
                : Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ${data.length} comandos registrados com sucesso!`);
        
        // Listar comandos registrados
        data.forEach(command => {
            console.log(`   - /${command.name}: ${command.description}`);
        });

    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
})();
