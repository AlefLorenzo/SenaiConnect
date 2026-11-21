const db = require('./db');

async function migrateGroupMuted() {
    console.log('Iniciando migração de grupos silenciados...');

    try {
        // Create group_muted table
        await db.query(`
            CREATE TABLE IF NOT EXISTS group_muted (
                group_id INT NOT NULL,
                user_id INT NOT NULL,
                muted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela group_muted criada.');

        // Create group_important table
        await db.query(`
            CREATE TABLE IF NOT EXISTS group_important (
                group_id INT NOT NULL,
                user_id INT NOT NULL,
                marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela group_important criada.');

        console.log('Migração de grupos silenciados/importantes concluída com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Falha na migração:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    migrateGroupMuted();
}

module.exports = migrateGroupMuted;