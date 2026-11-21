const db = require('./db');

async function migrateFeed() {
  try {
    console.log('Iniciando migração do Feed...');

    // 1. Adicionar categoria à tabela posts (ignorando erro se já existir)
    try {
      await db.query(`ALTER TABLE posts ADD COLUMN category VARCHAR(100) DEFAULT 'Geral'`);
      console.log('[OK] Coluna category adicionada em posts.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('[INFO] Coluna category já existe.');
      } else {
        throw err;
      }
    }

    // 2. Criar tabela user_interests
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_interests (
        user_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        score INT DEFAULT 1,
        last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, category),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('[OK] Tabela user_interests criada/verificada.');

    process.exit(0);
  } catch (e) {
    console.error('[ERRO]', e.message);
    process.exit(1);
  }
}

migrateFeed();
