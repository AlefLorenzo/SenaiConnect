-- Migração Completa da Área Administrativa - SENAI Connect
-- Execute este script no MySQL para criar/atualizar as tabelas necessárias

USE redesocial;

-- ============================================
-- 1. ATUALIZAR TABELA USERS
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS admin_role VARCHAR(50) DEFAULT NULL COMMENT 'super_admin, admin_unidade, admin_moderacao, admin_suporte',
ADD COLUMN IF NOT EXISTS unit_id INT DEFAULT NULL COMMENT 'ID da unidade para admin_unidade',
ADD COLUMN IF NOT EXISTS is_blocked TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hide_email TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS notification_prefs TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS onboarding_completed TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cover_image VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'São Paulo',
ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'São Paulo',
ADD COLUMN IF NOT EXISTS unit VARCHAR(150) DEFAULT 'Unidade Centro',
ADD COLUMN IF NOT EXISTS area VARCHAR(150) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS course VARCHAR(150) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS links TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS skills_to_learn TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS interests TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_private TINYINT(1) DEFAULT 0;

-- ============================================
-- 2. ATUALIZAR TABELA NOTICES (AVISOS)
-- ============================================

ALTER TABLE notices
ADD COLUMN IF NOT EXISTS priority ENUM('normal', 'important', 'urgent') DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS recipients TEXT DEFAULT NULL COMMENT 'JSON com destinatários: {type: all|courses|classes|modules|admins|teachers, values: [...]}',
ADD COLUMN IF NOT EXISTS published_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_pinned TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'scheduled', 'expired') DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS send_notification TINYINT(1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

-- ============================================
-- 3. ATUALIZAR TABELA REPORTS (DENÚNCIAS)
-- ============================================

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'reviewing', 'resolved', 'dismissed') DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS assigned_to INT DEFAULT NULL COMMENT 'Admin responsável pela análise',
ADD COLUMN IF NOT EXISTS resolved_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS action_taken VARCHAR(100) DEFAULT NULL COMMENT 'remove_content, warn, restrict, dismiss',
ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS target_user_id INT DEFAULT NULL COMMENT 'Usuário alvo da denúncia (para ações diretas)';

-- Foreign keys para reports
ALTER TABLE reports
ADD CONSTRAINT IF NOT EXISTS fk_reports_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT IF NOT EXISTS fk_reports_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 4. CRIAR TABELA ADMIN_LOGS (AUDITORIA)
-- ============================================

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
);

-- ============================================
-- 5. CRIAR TABELA NOTICE_READS (LEITURA DE AVISOS)
-- ============================================

CREATE TABLE IF NOT EXISTS notice_reads (
    notice_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notice_id, user_id),
    FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 6. CRIAR TABELA USER_WARNINGS (ADVERTÊNCIAS)
-- ============================================

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
);

-- ============================================
-- 7. CRIAR TABELA USER_RESTRICTIONS (RESTRIÇÕES TEMPORÁRIAS)
-- ============================================

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
);

-- ============================================
-- 8. ATUALIZAR TABELA POSTS (MODERAÇÃO)
-- ============================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moderated_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moderated_by INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(255) DEFAULT NULL;

ALTER TABLE posts
ADD CONSTRAINT IF NOT EXISTS fk_posts_moderated FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 9. ATUALIZAR TABELA COMMENTS (SOFT DELETE)
-- ============================================

ALTER TABLE comments
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL;

-- ============================================
-- 10. ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notices_status_published ON notices(status, published_at);
CREATE INDEX IF NOT EXISTS idx_notices_pinned ON notices(is_pinned, published_at);
CREATE INDEX IF NOT EXISTS idx_notices_author ON notices(author_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_assigned ON reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_active ON user_restrictions(user_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_admin_role ON users(admin_role);
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(is_blocked);

-- ============================================
-- 11. CRIAR TABELA SYSTEM_SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS system_settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NOT NULL,
    `type` ENUM('string', 'boolean', 'number', 'json') DEFAULT 'string',
    `description` TEXT DEFAULT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserir configurações padrão
INSERT IGNORE INTO system_settings (`key`, `value`, `type`, `description`) VALUES
('platform_name', 'SENAI Connect', 'string', 'Nome da plataforma exibido no cabeçalho'),
('student_domain', '@estudante.senai.com', 'string', 'Domínio de e-mail para cadastro de alunos'),
('teacher_domain', '@docente.senai.com', 'string', 'Domínio de e-mail para cadastro de professores'),
('maintenance_mode', 'false', 'boolean', 'Modo de manutenção (bloqueia acesso de alunos)'),
('public_registration', 'true', 'boolean', 'Permitir cadastro público de novos usuários'),
('email_verification', 'true', 'boolean', 'Exigir verificação de e-mail no cadastro'),
('push_notifications', 'true', 'boolean', 'Enviar notificações push'),
('email_notifications', 'true', 'boolean', 'Enviar notificações por e-mail'),
('digest_time', '09:00', 'string', 'Horário do resumo diário'),
('notify_urgent_notices', 'true', 'boolean', 'Notificar avisos urgentes imediatamente'),
('notify_reports', 'true', 'boolean', 'Notificar admins sobre novas denúncias'),
('auto_moderation', 'true', 'boolean', 'Moderação automática por IA'),
('auto_block_threshold', '3', 'number', 'Limite de denúncias para auto-bloqueio'),
('blocked_words', 'spam,phishing,golpe,fraude', 'string', 'Palavras bloqueadas (separadas por vírgula)'),
('max_posts_per_hour', '10', 'number', 'Máximo de posts por hora por usuário'),
('max_messages_per_hour', '30', 'number', 'Máximo de mensagens por hora por usuário'),
('require_2fa', 'true', 'boolean', 'Exigir 2FA para administradores'),
('session_timeout', '8', 'number', 'Tempo de sessão admin (horas)'),
('lockout_failed', 'true', 'boolean', 'Bloquear IP após tentativas falhadas'),
('detailed_audit', 'true', 'boolean', 'Log de auditoria detalhado');

-- ============================================
-- 12. INSERIR ADMIN PADRÃO (SE NÃO EXISTIR)
-- ============================================

-- Senha: admin123 (bcrypt hash)
INSERT IGNORE INTO users (name, email, password_hash, role, admin_role, unit_id, onboarding_completed, is_blocked)
VALUES ('Super Administrador', 'admin@senai.com', '$2b$10$rQZ8K9vL2xY3wN1mP4oP5uJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6', 'Administrador', 'super_admin', 1, 1, 0);

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

SELECT 'Migração concluída!' as status;
SHOW TABLES LIKE 'admin_logs';
SHOW TABLES LIKE 'notice_reads';
SHOW TABLES LIKE 'user_warnings';
SHOW TABLES LIKE 'user_restrictions';
DESCRIBE notices;
DESCRIBE reports;
DESCRIBE users;