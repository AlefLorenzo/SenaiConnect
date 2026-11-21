const mysql = require('mysql2/promise');

async function migrate() {
    const db = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'redesocial'
    });

    console.log('Iniciando migração de mensagens...');

    try {
        // 1. Criar tabelas base
        await db.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(20) DEFAULT 'direct',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Tabela conversations criada.');

        await db.query(`
            CREATE TABLE IF NOT EXISTS conversation_participants (
                conversation_id INT NOT NULL,
                user_id INT NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_read_message_id INT DEFAULT NULL,
                PRIMARY KEY (conversation_id, user_id),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela conversation_participants criada.');

        // 2. Adicionar colunas na tabela messages (se não existirem)
        try {
            await db.query('ALTER TABLE messages ADD COLUMN conversation_id INT DEFAULT NULL');
            await db.query('ALTER TABLE messages ADD CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE');
            console.log('Coluna conversation_id adicionada.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        try {
            await db.query('ALTER TABLE messages ADD COLUMN client_message_id VARCHAR(100) UNIQUE DEFAULT NULL');
            console.log('Coluna client_message_id adicionada.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }
        
        try {
            await db.query('ALTER TABLE messages ADD COLUMN delivered_at TIMESTAMP NULL DEFAULT NULL');
            await db.query('ALTER TABLE messages ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL');
            console.log('Colunas de timestamps adicionadas.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        // 3. Migrar dados antigos: Criar conversas para mensagens órfãs
        const [orphanMessages] = await db.query('SELECT DISTINCT sender_id, receiver_id FROM messages WHERE conversation_id IS NULL');
        
        if (orphanMessages.length > 0) {
            console.log(`Migrando ${orphanMessages.length} pares de contatos para conversations...`);
            for (let pair of orphanMessages) {
                const u1 = Math.min(pair.sender_id, pair.receiver_id);
                const u2 = Math.max(pair.sender_id, pair.receiver_id);
                
                // Verifica se já existe conversa entre os dois
                const [existing] = await db.query(`
                    SELECT cp1.conversation_id 
                    FROM conversation_participants cp1
                    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
                    WHERE cp1.user_id = ? AND cp2.user_id = ?
                `, [u1, u2]);

                let convId;
                if (existing.length > 0) {
                    convId = existing[0].conversation_id;
                } else {
                    const [res] = await db.query("INSERT INTO conversations (type) VALUES ('direct')");
                    convId = res.insertId;
                    await db.query("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)", [convId, u1, convId, u2]);
                }

                // Vincula as mensagens
                await db.query(`
                    UPDATE messages 
                    SET conversation_id = ? 
                    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                `, [convId, u1, u2, u2, u1]);
            }
        }
        
        // 4. Update existing schema file (optional, but good for new setups)
        // Note: done manually later if needed.

        console.log('Migração concluída com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Falha na migração:', err);
        process.exit(1);
    }
}

migrate();
