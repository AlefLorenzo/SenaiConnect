const db = require('./backend/db');

async function migrateOnboarding() {
    try {
        console.log('Iniciando migração de colunas de Onboarding...');
        
        const [columns] = await db.query("SHOW COLUMNS FROM users");
        const columnNames = columns.map(col => col.Field);

        if (!columnNames.includes('skills_to_learn')) {
            await db.query("ALTER TABLE users ADD COLUMN skills_to_learn TEXT DEFAULT NULL");
            console.log('Coluna skills_to_learn adicionada com sucesso.');
        } else {
            console.log('Coluna skills_to_learn já existe.');
        }

        if (!columnNames.includes('interests')) {
            await db.query("ALTER TABLE users ADD COLUMN interests TEXT DEFAULT NULL");
            console.log('Coluna interests adicionada com sucesso.');
        } else {
            console.log('Coluna interests já existe.');
        }

        console.log('Migração concluída com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('Erro na migração:', error);
        process.exit(1);
    }
}

migrateOnboarding();
