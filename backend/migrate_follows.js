const db = require('./db');

async function migrateFollows() {
  try {
    console.log('Iniciando migração do sistema de Follows...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS follows (
        follower_id INT NOT NULL,
        followed_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, followed_id),
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('[OK] Tabela follows criada/verificada.');

    // Opcional: Drop table friendships if you want a clean break
    try {
        await db.query(`DROP TABLE IF EXISTS friendships`);
        console.log('[OK] Tabela friendships removida.');
    } catch (e) {
        console.log('[INFO] Erro ao dropar friendships:', e.message);
    }

    process.exit(0);
  } catch (e) {
    console.error('[ERRO]', e.message);
    process.exit(1);
  }
}

migrateFollows();
