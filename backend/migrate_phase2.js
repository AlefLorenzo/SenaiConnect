require('dotenv').config();
const db = require('./db');

async function up() {
    try {
        console.log('Criando tabela courses e expandindo events/notices...');

        // Courses
        await db.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                author_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                unit VARCHAR(150),
                area VARCHAR(150),
                duration VARCHAR(100),
                modality VARCHAR(100) DEFAULT 'Presencial',
                period VARCHAR(100),
                skills TEXT,
                vacancies INT DEFAULT 0,
                enrollment_info TEXT,
                status VARCHAR(50) DEFAULT 'ativo',
                image_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('  ✅ courses criada');

        // Expandir events
        const [evCols] = await db.query('SHOW COLUMNS FROM events');
        const evNames = evCols.map(c => c.Field);

        if (!evNames.includes('unit'))         await db.query("ALTER TABLE events ADD COLUMN unit VARCHAR(150)");
        if (!evNames.includes('category'))     await db.query("ALTER TABLE events ADD COLUMN category VARCHAR(100)");
        if (!evNames.includes('vacancies'))    await db.query("ALTER TABLE events ADD COLUMN vacancies INT DEFAULT 0");
        if (!evNames.includes('image_url'))    await db.query("ALTER TABLE events ADD COLUMN image_url VARCHAR(255)");
        if (!evNames.includes('status'))       await db.query("ALTER TABLE events ADD COLUMN status VARCHAR(50) DEFAULT 'ativo'");
        if (!evNames.includes('event_time'))   await db.query("ALTER TABLE events ADD COLUMN event_time VARCHAR(10)");
        console.log('  ✅ events expandida');

        // Expandir notices
        const [noCols] = await db.query('SHOW COLUMNS FROM notices');
        const noNames = noCols.map(c => c.Field);

        if (!noNames.includes('unit'))       await db.query("ALTER TABLE notices ADD COLUMN unit VARCHAR(150)");
        if (!noNames.includes('priority'))   await db.query("ALTER TABLE notices ADD COLUMN priority VARCHAR(50) DEFAULT 'normal'");
        if (!noNames.includes('image_url'))  await db.query("ALTER TABLE notices ADD COLUMN image_url VARCHAR(255)");
        if (!noNames.includes('expires_at')) await db.query("ALTER TABLE notices ADD COLUMN expires_at DATETIME");
        console.log('  ✅ notices expandida');

        console.log('\nMigration Fase 2 concluída!');
        process.exit(0);
    } catch (err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

up();
