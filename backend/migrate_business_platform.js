require('dotenv').config();
const db = require('./db');

async function migrateBusinessPlatform() {
    try {
        console.log("Iniciando migração da plataforma de divulgação empresarial...");

        // ============================================
        // 1. TABELA DE EMPRESAS (BUSINESSES)
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS businesses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                owner_user_id INT NOT NULL UNIQUE,
                company_name VARCHAR(255) NOT NULL,
                slug VARCHAR(100) UNIQUE,
                logo_url VARCHAR(500),
                cover_image_url VARCHAR(500),
                description TEXT,
                sector VARCHAR(100),
                location VARCHAR(255),
                website VARCHAR(500),
                social_links JSON,
                contact_email VARCHAR(255),
                contact_phone VARCHAR(20),
                address TEXT,
                cnpj VARCHAR(18) UNIQUE,
                status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
                approved_at TIMESTAMP NULL,
                approved_by INT NULL,
                rejection_reason TEXT,
                followers_count INT DEFAULT 0,
                posts_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_status (status),
                INDEX idx_sector (sector),
                INDEX idx_location (location)
            )
        `);
        console.log('Tabela businesses criada/verificada.');

        // ============================================
        // 2. SEGUIDORES DE EMPRESAS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_followers (
                business_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (business_id, user_id),
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela business_followers criada/verificada.');

        // ============================================
        // 3. CAMPANHAS PUBLICITÁRIAS (deve vir antes de business_posts para FK)
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_campaigns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                business_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                objective ENUM('brand_awareness', 'traffic', 'conversions', 'leads', 'engagement') NOT NULL,
                budget DECIMAL(10,2) NOT NULL,
                spent DECIMAL(10,2) DEFAULT 0,
                billing_model ENUM('CPM', 'CPC', 'FIXED') NOT NULL,
                cpm_rate DECIMAL(10,4),
                cpc_rate DECIMAL(10,4),
                fixed_price DECIMAL(10,2),
                target_audience JSON,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                status ENUM('draft', 'pending_approval', 'approved', 'scheduled', 'active', 'paused', 'completed', 'rejected') DEFAULT 'draft',
                approved_at TIMESTAMP NULL,
                approved_by INT NULL,
                rejection_reason TEXT,
                impressions_count BIGINT DEFAULT 0,
                clicks_count BIGINT DEFAULT 0,
                ctr DECIMAL(5,4) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_business_status (business_id, status),
                INDEX idx_dates (start_date, end_date),
                INDEX idx_status_dates (status, start_date, end_date)
            )
        `);
        console.log('Tabela business_campaigns criada/verificada.');

        // ============================================
        // 4. ESPAÇOS PUBLICITÁRIOS (AD SPACES) - deve vir antes de campaign_creatives para FK
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS ad_spaces (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                location ENUM('business_feed_top', 'business_feed_middle', 'business_feed_bottom', 'business_stories', 'business_profile', 'business_sidebar', 'dashboard', 'global_feed', 'global_stories', 'notifications') NOT NULL,
                width INT NOT NULL,
                height INT NOT NULL,
                max_ads INT DEFAULT 1,
                frequency_cap INT DEFAULT 3,
                price_cpm DECIMAL(10,4),
                price_cpc DECIMAL(10,4),
                price_fixed DECIMAL(10,2),
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_location_active (location, is_active)
            )
        `);
        console.log('Tabela ad_spaces criada/verificada.');

        // ============================================
        // 5. CRIATIVOS DE CAMPANHA
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS campaign_creatives (
                id INT AUTO_INCREMENT PRIMARY KEY,
                campaign_id INT NOT NULL,
                ad_space_id INT NOT NULL,
                title VARCHAR(255),
                description TEXT,
                image_url VARCHAR(500) NOT NULL,
                destination_url VARCHAR(500) NOT NULL,
                width INT,
                height INT,
                file_size INT,
                mime_type VARCHAR(100),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES business_campaigns(id) ON DELETE CASCADE,
                FOREIGN KEY (ad_space_id) REFERENCES ad_spaces(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela campaign_creatives criada/verificada.');

        // ============================================
        // 6. PUBLICAÇÕES EMPRESARIAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                business_id INT NOT NULL,
                content TEXT,
                attachment_url VARCHAR(500),
                attachment_type ENUM('image', 'video', 'document', 'carousel') DEFAULT 'image',
                attachment_name VARCHAR(255),
                carousel_images JSON,
                post_type ENUM('general', 'job', 'internship', 'course', 'event', 'product', 'news', 'project') DEFAULT 'general',
                category VARCHAR(100) DEFAULT 'Geral',
                external_link VARCHAR(500),
                link_label VARCHAR(100),
                is_sponsored TINYINT(1) DEFAULT 0,
                campaign_id INT NULL,
                views_count INT DEFAULT 0,
                likes_count INT DEFAULT 0,
                comments_count INT DEFAULT 0,
                shares_count INT DEFAULT 0,
                saves_count INT DEFAULT 0,
                status ENUM('published', 'draft', 'archived') DEFAULT 'published',
                published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (campaign_id) REFERENCES business_campaigns(id) ON DELETE SET NULL,
                INDEX idx_business_published (business_id, published_at),
                INDEX idx_sponsored (is_sponsored, status),
                INDEX idx_post_type (post_type),
                INDEX idx_category (category),
                FULLTEXT idx_content (content)
            )
        `);
        console.log('Tabela business_posts criada/verificada.');

        // ============================================
        // 7. CURTIDAS EM PUBLICAÇÕES EMPRESARIAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_post_likes (
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES business_posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela business_post_likes criada/verificada.');

        // ============================================
        // 8. COMENTÁRIOS EM PUBLICAÇÕES EMPRESARIAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_post_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                content TEXT NOT NULL,
                parent_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES business_posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES business_post_comments(id) ON DELETE CASCADE,
                INDEX idx_post_created (post_id, created_at)
            )
        `);
        console.log('Tabela business_post_comments criada/verificada.');

        // ============================================
        // 9. COMPARTILHAMENTOS DE PUBLICAÇÕES EMPRESARIAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_post_shares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                quote TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES business_posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY uniq_share (post_id, user_id)
            )
        `);
        console.log('Tabela business_post_shares criada/verificada.');

        // ============================================
        // 10. PUBLICAÇÕES SALVAS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_post_saves (
                post_id INT NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES business_posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela business_post_saves criada/verificada.');

        // ============================================
        // 11. STORIES EMPRESARIAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_stories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                business_id INT NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type ENUM('image', 'video') NOT NULL,
                text_content TEXT,
                link_url VARCHAR(500),
                link_label VARCHAR(100),
                cta_text VARCHAR(50),
                expires_at TIMESTAMP NOT NULL,
                views_count INT DEFAULT 0,
                clicks_count INT DEFAULT 0,
                is_sponsored TINYINT(1) DEFAULT 0,
                campaign_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (campaign_id) REFERENCES business_campaigns(id) ON DELETE SET NULL,
                INDEX idx_business_expires (business_id, expires_at),
                INDEX idx_expires (expires_at)
            )
        `);
        console.log('Tabela business_stories criada/verificada.');

        // ============================================
        // 12. VISUALIZAÇÕES DE STORIES EMPRESARIAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_story_views (
                story_id INT NOT NULL,
                user_id INT NOT NULL,
                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (story_id, user_id),
                FOREIGN KEY (story_id) REFERENCES business_stories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela business_story_views criada/verificada.');

        // ============================================
        // 13. CLICKS EM STORIES EMPRESARIAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_story_clicks (
                story_id INT NOT NULL,
                user_id INT NOT NULL,
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (story_id, user_id),
                FOREIGN KEY (story_id) REFERENCES business_stories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela business_story_clicks criada/verificada.');

        // ============================================
        // 14. IMPRESSÕES DE ANÚNCIOS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS ad_impressions (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                creative_id INT NOT NULL,
                campaign_id INT NOT NULL,
                business_id INT NOT NULL,
                ad_space_id INT NOT NULL,
                user_id INT NULL,
                session_id VARCHAR(100),
                ip_hash VARCHAR(64),
                user_agent TEXT,
                referrer VARCHAR(500),
                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_valid TINYINT(1) DEFAULT 1,
                validation_notes TEXT,
                FOREIGN KEY (creative_id) REFERENCES campaign_creatives(id) ON DELETE CASCADE,
                FOREIGN KEY (campaign_id) REFERENCES business_campaigns(id) ON DELETE CASCADE,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (ad_space_id) REFERENCES ad_spaces(id) ON DELETE CASCADE,
                INDEX idx_campaign_date (campaign_id, viewed_at),
                INDEX idx_space_date (ad_space_id, viewed_at),
                INDEX idx_business_date (business_id, viewed_at),
                INDEX idx_user_session (user_id, session_id)
            )
        `);
        console.log('Tabela ad_impressions criada/verificada.');

        // ============================================
        // 15. CLICKS EM ANÚNCIOS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS ad_clicks (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                impression_id BIGINT NOT NULL,
                creative_id INT NOT NULL,
                campaign_id INT NOT NULL,
                business_id INT NOT NULL,
                ad_space_id INT NOT NULL,
                user_id INT NULL,
                ip_hash VARCHAR(64),
                clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_valid TINYINT(1) DEFAULT 1,
                FOREIGN KEY (impression_id) REFERENCES ad_impressions(id) ON DELETE CASCADE,
                FOREIGN KEY (creative_id) REFERENCES campaign_creatives(id) ON DELETE CASCADE,
                FOREIGN KEY (campaign_id) REFERENCES business_campaigns(id) ON DELETE CASCADE,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (ad_space_id) REFERENCES ad_spaces(id) ON DELETE CASCADE,
                INDEX idx_campaign_date (campaign_id, clicked_at),
                INDEX idx_impression (impression_id)
            )
        `);
        console.log('Tabela ad_clicks criada/verificada.');

        // ============================================
        // 16. FATURAS/NOTAS FISCAIS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                business_id INT NOT NULL,
                campaign_id INT NULL,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'BRL',
                status ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled') DEFAULT 'pending',
                billing_period_start DATE,
                billing_period_end DATE,
                due_date DATE,
                paid_at TIMESTAMP NULL,
                payment_method VARCHAR(50),
                payment_gateway_id VARCHAR(100),
                payment_gateway_data JSON,
                pix_qr_code TEXT,
                pix_code TEXT,
                pix_expires_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                FOREIGN KEY (campaign_id) REFERENCES business_campaigns(id) ON DELETE SET NULL,
                INDEX idx_business_status (business_id, status),
                INDEX idx_due_date (due_date),
                INDEX idx_gateway_id (payment_gateway_id)
            )
        `);
        console.log('Tabela invoices criada/verificada.');

        // ============================================
        // 17. PAGAMENTOS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT NOT NULL,
                business_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'BRL',
                status ENUM('pending', 'approved', 'rejected', 'refunded', 'cancelled') DEFAULT 'pending',
                payment_method VARCHAR(50),
                payment_gateway VARCHAR(50),
                gateway_transaction_id VARCHAR(100),
                gateway_response JSON,
                paid_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                INDEX idx_invoice (invoice_id),
                INDEX idx_business_status (business_id, status),
                INDEX idx_gateway_txn (gateway_transaction_id)
            )
        `);
        console.log('Tabela payments criada/verificada.');

        // ============================================
        // 18. DENÚNCIAS DE CONTEÚDO EMPRESARIAL
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reporter_id INT NOT NULL,
                target_type ENUM('business', 'business_post', 'business_story', 'business_comment') NOT NULL,
                target_id INT NOT NULL,
                reason VARCHAR(100) NOT NULL,
                description TEXT,
                status ENUM('pending', 'reviewing', 'resolved', 'dismissed') DEFAULT 'pending',
                assigned_to INT NULL,
                admin_notes TEXT,
                action_taken VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP NULL,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_target (target_type, target_id),
                INDEX idx_status (status)
            )
        `);
        console.log('Tabela business_reports criada/verificada.');

        // ============================================
        // 19. NOTIFICAÇÕES RELACIONADAS A EMPRESAS
        // ============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS business_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type ENUM('new_post', 'new_story', 'new_follower', 'like', 'comment', 'campaign_approved', 'campaign_rejected', 'campaign_started', 'campaign_ended', 'payment_received') NOT NULL,
                source_business_id INT NOT NULL,
                source_post_id INT NULL,
                source_story_id INT NULL,
                source_campaign_id INT NULL,
                content TEXT NOT NULL,
                action_url VARCHAR(500),
                is_read TINYINT(1) DEFAULT 0,
                read_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (source_business_id) REFERENCES businesses(id) ON DELETE CASCADE,
                INDEX idx_user_read (user_id, is_read),
                INDEX idx_user_created (user_id, created_at)
            )
        `);
        console.log('Tabela business_notifications criada/verificada.');

        // ============================================
        // 20. INSERIR ESPAÇOS PUBLICITÁRIOS PADRÃO
        // ============================================
        const adSpaces = [
            { name: 'Topo do Feed de Divulgação', slug: 'business_feed_top', location: 'business_feed_top', width: 1200, height: 400, price_cpm: 15.00, price_cpc: 2.50, price_fixed: 500.00 },
            { name: 'Meio do Feed de Divulgação', slug: 'business_feed_middle', location: 'business_feed_middle', width: 1200, height: 400, price_cpm: 12.00, price_cpc: 2.00, price_fixed: 400.00 },
            { name: 'Rodapé do Feed de Divulgação', slug: 'business_feed_bottom', location: 'business_feed_bottom', width: 1200, height: 400, price_cpm: 10.00, price_cpc: 1.50, price_fixed: 300.00 },
            { name: 'Stories de Divulgação', slug: 'business_stories', location: 'business_stories', width: 1080, height: 1920, price_cpm: 20.00, price_cpc: 3.00, price_fixed: 600.00 },
            { name: 'Sidebar do Perfil Empresarial', slug: 'business_profile', location: 'business_profile', width: 300, height: 600, price_cpm: 8.00, price_cpc: 1.20, price_fixed: 200.00 },
            { name: 'Feed Global (Home)', slug: 'global_feed', location: 'global_feed', width: 1200, height: 400, price_cpm: 25.00, price_cpc: 4.00, price_fixed: 1000.00 },
            { name: 'Stories Globais', slug: 'global_stories', location: 'global_stories', width: 1080, height: 1920, price_cpm: 30.00, price_cpc: 5.00, price_fixed: 1200.00 },
        ];

        for (const space of adSpaces) {
            try {
                await db.query(`
                    INSERT IGNORE INTO ad_spaces (name, slug, description, location, width, height, price_cpm, price_cpc, price_fixed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [space.name, space.slug, `Espaço publicitário: ${space.name}`, space.location, space.width, space.height, space.price_cpm, space.price_cpc, space.price_fixed]);
            } catch (e) {
                console.log(`Espaço ${space.slug} já existe ou erro:`, e.message);
            }
        }
        console.log('Espaços publicitários padrão inseridos/verificados.');

        // ============================================
        // 21. ATUALIZAR TABELA USERS PARA BUSINESS_OWNER
        // ============================================
        try {
            await db.query(`ALTER TABLE users ADD COLUMN is_business_owner TINYINT(1) DEFAULT 0`);
            console.log('Coluna users.is_business_owner adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.is_business_owner já existe.');
            } else {
                console.error('Erro ao adicionar users.is_business_owner:', e.message);
            }
        }

        try {
            await db.query(`ALTER TABLE users ADD COLUMN business_id INT NULL`);
            console.log('Coluna users.business_id adicionada.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna users.business_id já existe.');
            } else {
                console.error('Erro ao adicionar users.business_id:', e.message);
            }
        }

        // Verificar se FK já existe antes de criar
        try {
            const [fkCheck] = await db.query(`
                SELECT CONSTRAINT_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'business_id'
                AND REFERENCED_TABLE_NAME = 'businesses'
            `);

            if (fkCheck.length === 0) {
                await db.query(`ALTER TABLE users ADD CONSTRAINT fk_users_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL`);
                console.log('FK users.business_id adicionada.');
            } else {
                console.log('FK users.business_id já existe.');
            }
        } catch (e) {
            console.log('FK users.business_id já existe ou erro:', e.message);
        }

        console.log('\n✅ Migração da plataforma de divulgação empresarial concluída com sucesso!');

    } catch (err) {
        console.error('❌ Erro geral:', err);
        throw err;
    }
}

module.exports = { migrateBusinessPlatform };

if (require.main === module) {
    migrateBusinessPlatform().then(() => process.exit(0)).catch((err) => {
        console.error('❌ Erro geral:', err);
        process.exit(1);
    });
}