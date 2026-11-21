require('dotenv').config();
const db = require('./db');

async function fixSchema() {
    try {
        console.log("Iniciando correção do schema do banco...");

        // 1. Adicionar colunas faltantes na tabela notices
        const noticeColumns = [
            { name: 'status', definition: "ENUM('draft', 'published', 'scheduled', 'expired') DEFAULT 'draft'" },
            { name: 'priority', definition: "ENUM('normal', 'important', 'urgent') DEFAULT 'normal'" },
            { name: 'is_pinned', definition: "TINYINT(1) DEFAULT 0" },
            { name: 'published_at', definition: "DATETIME NULL" },
            { name: 'expires_at', definition: "DATETIME NULL" },
            { name: 'recipients', definition: "TEXT NULL" },
            { name: 'image_url', definition: "VARCHAR(500) NULL" },
            { name: 'attachment_url', definition: "VARCHAR(500) NULL" },
            { name: 'attachment_name', definition: "VARCHAR(255) NULL" },
            { name: 'send_notification', definition: "TINYINT(1) DEFAULT 1" },
            { name: 'recipients', definition: "TEXT NULL" },
            { name: 'expires_at', definition: "DATETIME NULL" },
            { name: 'updated_at', definition: "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" }
        ];

        for (const col of noticeColumns) {
            try {
                await db.query(`ALTER TABLE notices ADD COLUMN ${col.name} ${col.definition}`);
                console.log(`Coluna notices.${col.name} adicionada.`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Coluna notices.${col.name} já existe.`);
                } else {
                    console.error(`Erro ao adicionar notices.${col.name}:`, e.message);
                }
            }
        }

        // 2. Adicionar coluna assigned_to na tabela reports
        try {
            await db.query(`ALTER TABLE reports ADD COLUMN assigned_to INT NULL`);
            await db.query(`ALTER TABLE reports ADD CONSTRAINT fk_reports_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL`);
            console.log('Coluna reports.assigned_to adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna reports.assigned_to já existe.');
            } else {
                console.error('Erro ao adicionar reports.assigned_to:', e.message);
            }
        }

        // 3. Adicionar colunas faltantes na tabela posts (se não existirem)
        const postColumns = [
            { name: 'deleted_at', definition: "DATETIME NULL" },
            { name: 'feeling', definition: "VARCHAR(80) NULL" },
            { name: 'shared_post_id', definition: "INT NULL" },
            { name: 'post_type', definition: "VARCHAR(50) DEFAULT 'general'" },
            { name: 'category', definition: "VARCHAR(100) DEFAULT 'Geral'" }
        ];

        for (const col of postColumns) {
            try {
                await db.query(`ALTER TABLE posts ADD COLUMN ${col.name} ${col.definition}`);
                console.log(`Coluna posts.${col.name} adicionada.`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Coluna posts.${col.name} já existe.`);
                } else {
                    console.error(`Erro ao adicionar posts.${col.name}:`, e.message);
                }
            }
        }

        // 4. Adicionar colunas faltantes na tabela comments
        try {
            await db.query(`ALTER TABLE comments ADD COLUMN parent_id INT NULL`);
            await db.query(`ALTER TABLE comments ADD CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE`);
            console.log('Coluna comments.parent_id adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna comments.parent_id já existe.');
            } else {
                console.error('Erro ao adicionar comments.parent_id:', e.message);
            }
        }

        // 5. Adicionar colunas faltantes na tabela groups_table
        try {
            await db.query(`ALTER TABLE groups_table ADD COLUMN is_private TINYINT(1) DEFAULT 0`);
            console.log('Coluna groups_table.is_private adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna groups_table.is_private já existe.');
            } else {
                console.error('Erro ao adicionar groups_table.is_private:', e.message);
            }
        }

        // 6. Adicionar colunas faltantes na tabela group_members
        try {
            await db.query(`ALTER TABLE group_members ADD COLUMN role VARCHAR(20) DEFAULT 'member'`);
            console.log('Coluna group_members.role adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna group_members.role já existe.');
            } else {
                console.error('Erro ao adicionar group_members.role:', e.message);
            }
        }

        // 7. Adicionar colunas faltantes na tabela messages
        const messageColumns = [
            { name: 'reply_to_id', definition: "INT NULL" },
            { name: 'message_type', definition: "VARCHAR(20) DEFAULT 'text'" },
            { name: 'media_url', definition: "VARCHAR(500) NULL" },
            { name: 'attachment_name', definition: "VARCHAR(255) NULL" },
            { name: 'client_message_id', definition: "VARCHAR(100) UNIQUE NULL" },
            { name: 'delivered_at', definition: "TIMESTAMP NULL" },
            { name: 'read_at', definition: "TIMESTAMP NULL" },
            { name: 'conversation_id', definition: "INT NULL" }
        ];

        for (const col of messageColumns) {
            try {
                await db.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.definition}`);
                console.log(`Coluna messages.${col.name} adicionada.`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Coluna messages.${col.name} já existe.`);
                } else {
                    console.error(`Erro ao adicionar messages.${col.name}:`, e.message);
                }
            }
        }

        // 8. Adicionar foreign key para messages.conversation_id
        try {
            await db.query(`ALTER TABLE messages ADD CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE`);
            console.log('FK messages.conversation_id adicionada.');
        } catch (e) {
            if (e.code === 'ER_CANNOT_ADD_FOREIGN') {
                console.log('FK messages.conversation_id já existe ou erro de constraint.');
            } else {
                console.error('Erro ao adicionar FK messages.conversation_id:', e.message);
            }
        }

        // 9. Criar tabelas que faltam
        const tables = [
            `CREATE TABLE IF NOT EXISTS event_registrations (
                event_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (event_id, user_id),
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS notice_reads (
                notice_id INT NOT NULL,
                user_id INT NOT NULL,
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notice_id, user_id),
                FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS post_shares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_share (post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS comment_likes (
                comment_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (comment_id, user_id),
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS mutes (
                muter_id INT NOT NULL,
                muted_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (muter_id, muted_id),
                FOREIGN KEY (muter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (muted_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS hashtags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tag VARCHAR(80) NOT NULL UNIQUE,
                usage_count INT DEFAULT 1
            )`,
            `CREATE TABLE IF NOT EXISTS post_hashtags (
                post_id INT NOT NULL,
                hashtag_id INT NOT NULL,
                PRIMARY KEY (post_id, hashtag_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reporter_id INT NOT NULL,
                target_type VARCHAR(30) NOT NULL,
                target_id INT NOT NULL,
                reason VARCHAR(100) NOT NULL,
                description TEXT,
                status VARCHAR(30) DEFAULT 'pending',
                assigned_to INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
            )`,
            `CREATE TABLE IF NOT EXISTS blocks (
                blocker_id INT NOT NULL,
                blocked_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (blocker_id, blocked_id),
                FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS course_enrollments (
                course_id INT NOT NULL,
                user_id INT NOT NULL,
                progress INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (course_id, user_id),
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS admin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                action VARCHAR(255) NOT NULL,
                target_type VARCHAR(100) NULL,
                target_id INT NULL,
                description TEXT NULL,
                metadata LONGTEXT NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS notice_reads (
                notice_id INT NOT NULL,
                user_id INT NOT NULL,
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notice_id, user_id),
                FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS post_shares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_share (post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS comment_likes (
                comment_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (comment_id, user_id),
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS mutes (
                muter_id INT NOT NULL,
                muted_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (muter_id, muted_id),
                FOREIGN KEY (muter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (muted_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS hashtags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tag VARCHAR(80) NOT NULL UNIQUE,
                usage_count INT DEFAULT 1
            )`,
            `CREATE TABLE IF NOT EXISTS post_hashtags (
                post_id INT NOT NULL,
                hashtag_id INT NOT NULL,
                PRIMARY KEY (post_id, hashtag_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS blocks (
                blocker_id INT NOT NULL,
                blocked_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (blocker_id, blocked_id),
                FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS course_enrollments (
                course_id INT NOT NULL,
                user_id INT NOT NULL,
                progress INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (course_id, user_id),
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS notice_reads (
                notice_id INT NOT NULL,
                user_id INT NOT NULL,
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notice_id, user_id),
                FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS post_shares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_share (post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS comment_likes (
                comment_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (comment_id, user_id),
                FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS mutes (
                muter_id INT NOT NULL,
                muted_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (muter_id, muted_id),
                FOREIGN KEY (muter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (muted_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS hashtags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tag VARCHAR(80) NOT NULL UNIQUE,
                usage_count INT DEFAULT 1
            )`,
            `CREATE TABLE IF NOT EXISTS post_hashtags (
                post_id INT NOT NULL,
                hashtag_id INT NOT NULL,
                PRIMARY KEY (post_id, hashtag_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS blocks (
                blocker_id INT NOT NULL,
                blocked_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (blocker_id, blocked_id),
                FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS course_enrollments (
                course_id INT NOT NULL,
                user_id INT NOT NULL,
                progress INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (course_id, user_id),
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`
        ];

        for (const sql of tables) {
            try {
                await db.query(sql);
                console.log('Tabela criada/verificada.');
            } catch (e) {
                if (e.code === 'ER_TABLE_EXISTS_ERROR') {
                    console.log('Tabela já existe.');
                } else {
                    console.error('Erro ao criar tabela:', e.message);
                }
            }
        }

        // 10. Adicionar foreign key para reports.assigned_to se não existe
        try {
            await db.query(`ALTER TABLE reports ADD CONSTRAINT fk_reports_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL`);
            console.log('FK reports.assigned_to adicionada.');
        } catch (e) {
            console.log('FK reports.assigned_to já existe ou erro:', e.message);
        }

        // 11. Adicionar coluna is_private na tabela users se não existe
        try {
            await db.query(`ALTER TABLE users ADD COLUMN is_private TINYINT(1) DEFAULT 0`);
            console.log('Coluna users.is_private adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.is_private já existe.');
            } else {
                console.error('Erro ao adicionar users.is_private:', e.message);
            }
        }

        // 12. Adicionar coluna is_blocked na tabela users se não existe
        try {
            await db.query(`ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) DEFAULT 0`);
            console.log('Coluna users.is_blocked adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.is_blocked já existe.');
            } else {
                console.error('Erro ao adicionar users.is_blocked:', e.message);
            }
        }

        // 13. Adicionar coluna deleted_at na tabela users
        try {
            await db.query(`ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL`);
            console.log('Coluna users.deleted_at adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.deleted_at já existe.');
            } else {
                console.error('Erro ao adicionar users.deleted_at:', e.message);
            }
        }

        // 14. Adicionar coluna hide_email na tabela users
        try {
            await db.query(`ALTER TABLE users ADD COLUMN hide_email TINYINT(1) DEFAULT 0`);
            console.log('Coluna users.hide_email adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.hide_email já existe.');
            } else {
                console.error('Erro ao adicionar users.hide_email:', e.message);
            }
        }

        // 15. Adicionar coluna notification_prefs na tabela users
        try {
            await db.query(`ALTER TABLE users ADD COLUMN notification_prefs TEXT NULL`);
            console.log('Coluna users.notification_prefs adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.notification_prefs já existe.');
            } else {
                console.error('Erro ao adicionar users.notification_prefs:', e.message);
            }
        }

        // 16. Adicionar coluna onboarding_completed na tabela users
        try {
            await db.query(`ALTER TABLE users ADD COLUMN onboarding_completed TINYINT(1) DEFAULT 0`);
            console.log('Coluna users.onboarding_completed adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.onboarding_completed já existe.');
            } else {
                console.error('Erro ao adicionar users.onboarding_completed:', e.message);
            }
        }

        // 17. Adicionar coluna admin_role na tabela users
        try {
            await db.query(`ALTER TABLE users ADD COLUMN admin_role VARCHAR(50) NULL`);
            console.log('Coluna users.admin_role adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.admin_role já existe.');
            } else {
                console.error('Erro ao adicionar users.admin_role:', e.message);
            }
        }

        // 18. Adicionar coluna unit_id na tabela users
        try {
            await db.query(`ALTER TABLE users ADD COLUMN unit_id INT NULL`);
            console.log('Coluna users.unit_id adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.unit_id já existe.');
            } else {
                console.error('Erro ao adicionar users.unit_id:', e.message);
            }
        }

        // 19. Adicionar FK users.unit_id
        try {
            await db.query(`ALTER TABLE users ADD CONSTRAINT fk_users_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL`);
            console.log('FK users.unit_id adicionada.');
        } catch (e) {
            console.log('FK users.unit_id já existe ou erro:', e.message);
        }

        // 20. Criar tabela units se não existe
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS units (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    code VARCHAR(50) UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Tabela units criada/verificada.');
        } catch (e) {
            console.error('Erro ao criar tabela units:', e.message);
        }

        // 21. Inserir unidades padrão
        try {
            await db.query(`
                INSERT IGNORE INTO units (id, name, code) VALUES
                (1, 'SENAI Central', 'CENTRAL'),
                (2, 'SENAI Informática', 'INFO'),
                (3, 'SENAI Automação', 'AUTO'),
                (4, 'SENAI Telecomunicações', 'TELECOM'),
                (5, 'SENAI Eletroeletrônica', 'ELETRO'),
                (6, 'SENAI Gestão', 'GESTAO'),
                (7, 'SENAI Design', 'DESIGN'),
                (8, 'SENAI Logística', 'LOG'),
                (9, 'SENAI Automação Industrial', 'AUTO_IND')
            `);
            console.log('Unidades padrão inseridas.');
        } catch (e) {
            console.log('Unidades já existem ou erro:', e.message);
        }

        console.log('\n✅ Schema corrigido com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro geral:', err);
        process.exit(1);
    }
}

fixSchema();