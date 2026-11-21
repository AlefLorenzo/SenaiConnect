require('dotenv').config();
const db = require('./db');

async function up() {
    try {
        console.log("Iniciando migration administrativa...");

        // 1. Adicionar colunas administrativas na tabela users, se não existirem
        const [columns] = await db.query("SHOW COLUMNS FROM users");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('admin_role')) {
            console.log("Adicionando coluna admin_role...");
            await db.query("ALTER TABLE users ADD COLUMN admin_role VARCHAR(50) DEFAULT NULL");
        }
        
        if (!columnNames.includes('unit_id')) {
            console.log("Adicionando coluna unit_id...");
            await db.query("ALTER TABLE users ADD COLUMN unit_id INT DEFAULT NULL");
        }

        // 2. Criar tabela admin_logs de forma segura
        console.log("Criando tabela admin_logs...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                action VARCHAR(255) NOT NULL,
                target_type VARCHAR(100) DEFAULT NULL,
                target_id INT DEFAULT NULL,
                description TEXT DEFAULT NULL,
                metadata LONGTEXT DEFAULT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log("Migration administrativa concluída com sucesso!");
        process.exit(0);
    } catch (err) {
        console.error("Erro na migration administrativa:", err);
        process.exit(1);
    }
}

up();
