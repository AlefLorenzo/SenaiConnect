require('dotenv').config();
const db = require('./db');

async function up() {
    try {
        console.log("Iniciando migração completa da área administrativa...");

        // 1. Adicionar colunas administrativas na tabela users (se não existirem)
        const [userColumns] = await db.query("SHOW COLUMNS FROM users");
        const userColumnNames = userColumns.map(c => c.Field);

        const userColumnsToAdd = [
            { name: 'admin_role', definition: "VARCHAR(50) DEFAULT NULL COMMENT 'super_admin, admin_unidade, admin_moderacao, admin_suporte'" },
            { name: 'unit_id', definition: "INT DEFAULT NULL COMMENT 'ID da unidade para admin_unidade'" },
            { name: 'is_blocked', definition: "TINYINT(1) DEFAULT 0" },
            { name: 'hide_email', definition: "TINYINT(1) DEFAULT 0" },
            { name: 'notification_prefs', definition: "TEXT DEFAULT NULL" },
            { name: 'deleted_at', definition: "DATETIME NULL" },
            { name: 'onboarding_completed', definition: "TINYINT(1) DEFAULT 0" },
            { name: 'cover_image', definition: "VARCHAR(255) DEFAULT NULL" },
            { name: 'state', definition: "VARCHAR(100) DEFAULT 'São Paulo'" },
            { name: 'city', definition: "VARCHAR(100) DEFAULT 'São Paulo'" },
            { name: 'unit', definition: "VARCHAR(150) DEFAULT 'Unidade Centro'" },
            { name: 'area', definition: "VARCHAR(150) DEFAULT NULL" },
            { name: 'course', definition: "VARCHAR(150) DEFAULT NULL" },
            { name: 'links', definition: "TEXT DEFAULT NULL" },
            { name: 'skills', definition: "TEXT DEFAULT NULL" },
            { name: 'skills_to_learn', definition: "TEXT DEFAULT NULL" },
            { name: 'interests', definition: "TEXT DEFAULT NULL" },
            { name: 'objective', definition: "TEXT DEFAULT NULL" },
            { name: 'is_private', definition: "TINYINT(1) DEFAULT 0" },
        ];

        for (const col of userColumnsToAdd) {
            if (!userColumnNames.includes(col.name)) {
                console.log(`Adicionando coluna users.${col.name}...`);
                await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.definition}`);
            } else {
                console.log(`Coluna users.${col.name} já existe.`);
            }
        }

        // 2. Atualizar tabela notices com campos administrativos
        const [noticeColumns] = await db.query("SHOW COLUMNS FROM notices");
        const noticeColumnNames = noticeColumns.map(c => c.Field);

        const noticeColumnsToAdd = [
            { name: 'priority', definition: "ENUM('normal', 'important', 'urgent') DEFAULT 'normal'" },
            { name: 'recipients', definition: "TEXT DEFAULT NULL COMMENT 'JSON com destinatários: {type: all|courses|classes|modules|admins|teachers, values: [...]'}'" },
            { name: 'published_at', definition: "DATETIME NULL DEFAULT NULL" },
            { name: 'expires_at', definition: "DATETIME NULL DEFAULT NULL" },
            { name: 'is_pinned', definition: "TINYINT(1) DEFAULT 0" },
            { name: 'status', definition: "ENUM('draft', 'published', 'scheduled', 'expired') DEFAULT 'draft'" },
            { name: 'image_url', definition: "VARCHAR(500) DEFAULT NULL" },
            { name: 'attachment_url', definition: "VARCHAR(500) DEFAULT NULL" },
            { name: 'attachment_name', definition: "VARCHAR(255) DEFAULT NULL" },
            { name: 'send_notification', definition: "TINYINT(1) DEFAULT 1" },
            { name: 'updated_at', definition: "TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP" },
        ];

        for (const col of noticeColumnsToAdd) {
            if (!noticeColumnNames.includes(col.name)) {
                console.log(`Adicionando coluna notices.${col.name}...`);
                await db.query(`ALTER TABLE notices ADD COLUMN ${col.name} ${col.definition}`);
            } else {
                console.log(`Coluna notices.${col.name} já existe.`);
            }
        }

        // 3. Atualizar tabela reports com campos de moderação
        const [reportColumns] = await db.query("SHOW COLUMNS FROM reports");
        const reportColumnNames = reportColumns.map(c => c.Field);

        const reportColumnsToAdd = [
            { name: 'status', definition: "ENUM('pending', 'reviewing', 'resolved', 'dismissed') DEFAULT 'pending'" },
            { name: 'assigned_to', definition: "INT DEFAULT NULL COMMENT 'Admin responsável pela análise'" },
            { name: 'resolved_at', definition: "DATETIME NULL DEFAULT NULL" },
            { name: 'action_taken', definition: "VARCHAR(100) DEFAULT NULL COMMENT 'remove_content, warn, restrict, dismiss'" },
            { name: 'admin_notes', definition: "TEXT DEFAULT NULL" },
            { name: 'target_user_id', definition: "INT DEFAULT NULL COMMENT 'Usuário alvo da denúncia (para ações diretas)' }" },
        ];

        for (const col of reportColumnsToAdd) {
            if (!reportColumnNames.includes(col.name)) {
                console.log(`Adicionando coluna reports.${col.name}...`);
                await db.query(`ALTER TABLE reports ADD COLUMN ${col.name} ${col.definition}`);
            } else {
                console.log(`Coluna reports.${col.name} já existe.`);
            }
        }

        // Adicionar foreign key para assigned_to se não existir
        try {
            await db.query(`ALTER TABLE reports ADD CONSTRAINT fk_reports_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL`);
            console.log('FK reports.assigned_to adicionada.');
        } catch (e) {
            if (!e.message.includes('Duplicate')) console.log('FK reports.assigned_to já existe ou erro:', e.message);
        }

        try {
            await db.query(`ALTER TABLE reports ADD CONSTRAINT fk_reports_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL`);
            console.log('FK reports.target_user_id adicionada.');
        } catch (e) {
            if (!e.message.includes('Duplicate')) console.log('FK reports.target_user_id já existe ou erro:', e.message);
        }

        // 4. Criar tabela admin_logs (auditoria completa) se não existir
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                action_label VARCHAR(100) NOT NULL,
                target_type VARCHAR(50) DEFAULT NULL,
                target_id INT DEFAULT NULL,
                target_name VARCHAR(255) DEFAULT NULL,
                description TEXT DEFAULT NULL,
                metadata LONGTEXT DEFAULT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_admin_logs_admin (admin_id),
                INDEX idx_admin_logs_target (target_type, target_id),
                INDEX idx_admin_logs_created (created_at)
            )
        `);
        console.log('Tabela admin_logs verificada/criada.');

        // 5. Criar tabela notice_reads (controle de leitura de avisos)
        await db.query(`
            CREATE TABLE IF NOT EXISTS notice_reads (
                notice_id INT NOT NULL,
                user_id INT NOT NULL,
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notice_id, user_id),
                FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela notice_reads verificada/criada.');

        // 6. Criar tabela user_warnings (advertências)
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_warnings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                admin_id INT NOT NULL,
                reason VARCHAR(255) NOT NULL,
                description TEXT DEFAULT NULL,
                report_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL,
                INDEX idx_user_warnings_user (user_id)
            )
        `);
        console.log('Tabela user_warnings verificada/criada.');

        // 7. Criar tabela user_restrictions (restrições temporárias)
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_restrictions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                admin_id INT NOT NULL,
                reason VARCHAR(255) NOT NULL,
                description TEXT DEFAULT NULL,
                features JSON DEFAULT NULL COMMENT '["post", "comment", "message", "group"]',
                starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_restrictions_user (user_id),
                INDEX idx_user_restrictions_active (is_active, expires_at)
            )
        `);
        console.log('Tabela user_restrictions verificada/criada.');

        // 8. Atualizar posts com soft delete e campos de moderação
        const [postColumns] = await db.query("SHOW COLUMNS FROM posts");
        const postColumnNames = postColumns.map(c => c.Field);

        const postColumnsToAdd = [
            { name: 'deleted_at', definition: "DATETIME NULL DEFAULT NULL" },
            { name: 'moderated_at', definition: "DATETIME NULL DEFAULT NULL" },
            { name: 'moderated_by', definition: "INT DEFAULT NULL" },
            { name: 'moderation_reason', definition: "VARCHAR(255) DEFAULT NULL" },
        ];

        for (const col of postColumnsToAdd) {
            if (!postColumnNames.includes(col.name)) {
                console.log(`Adicionando coluna posts.${col.name}...`);
                await db.query(`ALTER TABLE posts ADD COLUMN ${col.name} ${col.definition}`);
            } else {
                console.log(`Coluna posts.${col.name} já existe.`);
            }
        }

        try {
            await db.query(`ALTER TABLE posts ADD CONSTRAINT fk_posts_moderated FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL`);
            console.log('FK posts.moderated_by adicionada.');
        } catch (e) {
            if (!e.message.includes('Duplicate')) console.log('FK posts.moderated_by já existe ou erro:', e.message);
        }

        // 9. Atualizar comments com soft delete
        const [commentColumns] = await db.query("SHOW COLUMNS FROM comments");
        const commentColumnNames = commentColumns.map(c => c.Field);

        if (!commentColumnNames.includes('deleted_at')) {
            console.log('Adicionando coluna comments.deleted_at...');
            await db.query(`ALTER TABLE comments ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL`);
        } else {
            console.log('Coluna comments.deleted_at já existe.');
        }

        // 10. Criar índices para performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_notices_status_published ON notices(status, published_at)',
            'CREATE INDEX IF NOT EXISTS idx_notices_pinned ON notices(is_pinned, published_at)',
            'CREATE INDEX IF NOT EXISTS idx_notices_author ON notices(author_id)',
            'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)',
            'CREATE INDEX IF NOT EXISTS idx_reports_assigned ON reports(assigned_to)',
            'CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON user_warnings(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_restrictions_active ON user_restrictions(user_id, is_active, expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted_at)',
            'CREATE INDEX IF NOT EXISTS idx_users_admin_role ON users(admin_role)',
            'CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(is_blocked)',
        ];

        for (const indexSql of indexes) {
            try {
                await db.query(indexSql);
                console.log(`Índice criado: ${indexSql.substring(0, 60)}...`);
            } catch (e) {
                if (!e.message.includes('Duplicate') && !e.message.includes('already exists')) {
                    console.log('Erro ao criar índice:', e.message);
                }
            }
        }

        // 11. Inserir admin padrão se não existir
        const [existingAdmin] = await db.query("SELECT id FROM users WHERE email = 'admin@senai.com' AND admin_role = 'super_admin'");
        if (existingAdmin.length === 0) {
            const bcrypt = require('bcrypt');
            const hash = await bcrypt.hash('admin123', 10);
            await db.query(`
                INSERT INTO users (name, email, password_hash, role, admin_role, unit_id, onboarding_completed, is_blocked)
                VALUES ('Super Administrador', 'admin@senai.com', ?, 'Administrador', 'super_admin', 1, 1, 0)
            `, [hash]);
            console.log('Super admin padrão criado (email: admin@senai.com, senha: admin123).');
        } else {
            console.log('Super admin já existe.');
        }

        console.log("\n✅ Migração administrativa completa concluída com sucesso!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro na migração administrativa:", err);
        process.exit(1);
    }
}

up();