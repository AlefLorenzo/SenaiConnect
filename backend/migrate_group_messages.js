const db = require('./db');

async function migrateGroupMessages() {
    console.log('Iniciando migração de mensagens de grupo...');

    try {
        // Create group_messages table
        await db.query(`
            CREATE TABLE IF NOT EXISTS group_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                group_id INT NOT NULL,
                sender_id INT NOT NULL,
                content TEXT,
                status ENUM('enviada', 'entregue', 'lida') DEFAULT 'enviada',
                message_type ENUM('text', 'image', 'document', 'file') DEFAULT 'text',
                media_url VARCHAR(500) DEFAULT NULL,
                attachment_name VARCHAR(255) DEFAULT NULL,
                attachment_size BIGINT DEFAULT NULL,
                attachment_type VARCHAR(100) DEFAULT NULL,
                reply_to_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reply_to_id) REFERENCES group_messages(id) ON DELETE SET NULL,
                INDEX idx_group_created (group_id, created_at),
                INDEX idx_sender (sender_id)
            )
        `);
        console.log('Tabela group_messages criada.');

        // Create group_last_read table
        await db.query(`
            CREATE TABLE IF NOT EXISTS group_last_read (
                group_id INT NOT NULL,
                user_id INT NOT NULL,
                last_read_message_id INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela group_last_read criada.');

        // Create group_admins table if not exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS group_admins (
                group_id INT NOT NULL,
                admin_id INT NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                assigned_by INT NOT NULL,
                PRIMARY KEY (group_id, admin_id),
                FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela group_admins criada.');

        // Add is_online column to group_members if not exists (for presence)
        try {
            await db.query('ALTER TABLE group_members ADD COLUMN is_online TINYINT(1) DEFAULT 0');
            console.log('Coluna is_online adicionada em group_members.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        console.log('Migração de mensagens de grupo concluída com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Falha na migração:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    migrateGroupMessages();
}

module.exports = migrateGroupMessages;