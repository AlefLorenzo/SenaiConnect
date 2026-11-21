const db = require('./db');

async function migrateMessagingFixes() {
    console.log('Iniciando migração de correções de mensagens...');

    try {
        // 1. Create conversations table if not exists (with group_id column)
        await db.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type ENUM('direct', 'group') DEFAULT 'direct',
                group_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE SET NULL,
                INDEX idx_type (type)
            )
        `);
        console.log('Tabela conversations criada/verificada.');

        // Ensure group_id column exists in conversations
        try {
            await db.query('ALTER TABLE conversations ADD COLUMN group_id INT DEFAULT NULL');
            await db.query('ALTER TABLE conversations ADD CONSTRAINT fk_conv_group FOREIGN KEY (group_id) REFERENCES groups_table(id) ON DELETE SET NULL');
            console.log('Coluna group_id adicionada em conversations.');
        } catch (e) {
            if (!e.message.includes('Duplicate column') && !e.message.includes('Duplicate key')) console.error(e.message);
        }

        // 2. Create conversation_participants table if not exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS conversation_participants (
                conversation_id INT NOT NULL,
                user_id INT NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_read_message_id INT DEFAULT NULL,
                left_at TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (conversation_id, user_id),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela conversation_participants criada/verificada.');

        // 3. Add conversation_id to messages table if not exists
        try {
            await db.query('ALTER TABLE messages ADD COLUMN conversation_id INT DEFAULT NULL');
            await db.query('ALTER TABLE messages ADD CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL');
            console.log('Coluna conversation_id adicionada em messages.');
        } catch (e) {
            if (!e.message.includes('Duplicate column') && !e.message.includes('Duplicate key')) console.error(e.message);
        }

        // 4. Add conversation_id to group_messages table if not exists
        try {
            await db.query('ALTER TABLE group_messages ADD COLUMN conversation_id INT DEFAULT NULL');
            await db.query('ALTER TABLE group_messages ADD CONSTRAINT fk_gmsg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL');
            console.log('Coluna conversation_id adicionada em group_messages.');
        } catch (e) {
            if (!e.message.includes('Duplicate column') && !e.message.includes('Duplicate key')) console.error(e.message);
        }

        // 5. Add client_message_id for deduplication
        try {
            await db.query('ALTER TABLE messages ADD COLUMN client_message_id VARCHAR(100) UNIQUE DEFAULT NULL');
            await db.query('ALTER TABLE group_messages ADD COLUMN client_message_id VARCHAR(100) UNIQUE DEFAULT NULL');
            console.log('Colunas client_message_id adicionadas.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        // 6. Add delivered_at and read_at timestamps
        try {
            await db.query('ALTER TABLE messages ADD COLUMN delivered_at TIMESTAMP NULL DEFAULT NULL');
            await db.query('ALTER TABLE messages ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL');
            await db.query('ALTER TABLE group_messages ADD COLUMN delivered_at TIMESTAMP NULL DEFAULT NULL');
            await db.query('ALTER TABLE group_messages ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL');
            console.log('Colunas de timestamps adicionadas.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        // 7. Add reply_to_id for message replies
        try {
            await db.query('ALTER TABLE messages ADD COLUMN reply_to_id INT DEFAULT NULL');
            await db.query('ALTER TABLE messages ADD CONSTRAINT fk_msg_reply FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL');
            await db.query('ALTER TABLE group_messages ADD COLUMN reply_to_id INT DEFAULT NULL');
            await db.query('ALTER TABLE group_messages ADD CONSTRAINT fk_gmsg_reply FOREIGN KEY (reply_to_id) REFERENCES group_messages(id) ON DELETE SET NULL');
            console.log('Colunas reply_to_id adicionadas.');
        } catch (e) {
            if (!e.message.includes('Duplicate column') && !e.message.includes('Duplicate key')) console.error(e.message);
        }

        // 8. Add is_edited and edited_at for message editing
        try {
            await db.query('ALTER TABLE messages ADD COLUMN is_edited TINYINT(1) DEFAULT 0');
            await db.query('ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP NULL DEFAULT NULL');
            await db.query('ALTER TABLE group_messages ADD COLUMN is_edited TINYINT(1) DEFAULT 0');
            await db.query('ALTER TABLE group_messages ADD COLUMN edited_at TIMESTAMP NULL DEFAULT NULL');
            console.log('Colunas de edição adicionadas.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        // 9. Add deleted flags for message deletion
        try {
            await db.query('ALTER TABLE messages ADD COLUMN deleted_for_everyone TINYINT(1) DEFAULT 0');
            await db.query('ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
            await db.query('ALTER TABLE group_messages ADD COLUMN deleted_for_everyone TINYINT(1) DEFAULT 0');
            await db.query('ALTER TABLE group_messages ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
            console.log('Colunas de exclusão adicionadas.');
        } catch (e) {
            if (!e.message.includes('Duplicate column')) console.error(e.message);
        }

        // 10. Create indexes for performance
        try {
            await db.query('CREATE INDEX idx_messages_conv_created ON messages (conversation_id, created_at)');
            await db.query('CREATE INDEX idx_gmessages_conv_created ON group_messages (conversation_id, created_at)');
            await db.query('CREATE INDEX idx_messages_client_id ON messages (client_message_id)');
            await db.query('CREATE INDEX idx_gmessages_client_id ON group_messages (client_message_id)');
            console.log('Índices de performance criados.');
        } catch (e) {
            if (!e.message.includes('Duplicate key')) console.error(e.message);
        }

        // 11. Migrate existing direct messages to conversations
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

        // 12. Migrate existing group messages to conversations
        const [groupConvs] = await db.query(`
            SELECT g.id, g.name FROM groups_table g
            LEFT JOIN conversations c ON c.group_id = g.id
            WHERE c.id IS NULL
        `);

        if (groupConvs.length > 0) {
            console.log(`Migrando ${groupConvs.length} grupos para conversations...`);
            for (const group of groupConvs) {
                const [res] = await db.query("INSERT INTO conversations (type, group_id) VALUES ('group', ?)", [group.id]);
                const convId = res.insertId;

                // Add all group members as participants
                const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [group.id]);
                for (const member of members) {
                    await db.query('INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [convId, member.user_id]);
                }

                // Update group_messages with conversation_id
                await db.query('UPDATE group_messages SET conversation_id = ? WHERE group_id = ?', [convId, group.id]);
            }
        }

        console.log('Migração de correções de mensagens concluída com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Falha na migração:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    migrateMessagingFixes();
}

module.exports = migrateMessagingFixes;