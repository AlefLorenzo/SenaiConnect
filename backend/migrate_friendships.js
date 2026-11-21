const db = require('./db');

async function migrate() {
  try {
    // 1. Friendships table
    await db.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        requester_id INT NOT NULL,
        addressee_id INT NOT NULL,
        status ENUM('pending','accepted','rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_friendship (requester_id, addressee_id),
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('[OK] Tabela friendships criada/verificada.');

    const [rows] = await db.query('SHOW TABLES');
    console.log('[OK] Tabelas no banco:', rows.map(r => Object.values(r)[0]).join(', '));

    process.exit(0);
  } catch (e) {
    console.error('[ERRO]', e.message);
    process.exit(1);
  }
}

migrate();
