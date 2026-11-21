const db = require('./db');
const { migrateBusinessPlatform } = require('./migrate_business_platform');

const statements = [
  'ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) DEFAULT 0',
  'ALTER TABLE users ADD COLUMN hide_email TINYINT(1) DEFAULT 0',
  'ALTER TABLE users ADD COLUMN notification_prefs TEXT',
  'ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL',
  'ALTER TABLE posts ADD COLUMN feeling VARCHAR(80) NULL',
  'ALTER TABLE posts ADD COLUMN shared_post_id INT NULL',
  'ALTER TABLE comments ADD COLUMN parent_id INT NULL',
  'ALTER TABLE groups_table ADD COLUMN is_private TINYINT(1) DEFAULT 0',
  'ALTER TABLE group_members ADD COLUMN role VARCHAR(20) DEFAULT "member"',
  'ALTER TABLE messages ADD COLUMN reply_to_id INT NULL',
  'ALTER TABLE notices ADD COLUMN is_pinned TINYINT(1) DEFAULT 0',
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
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
];

async function migrateComplete() {
  for (const sql of statements) {
    try {
      await db.query(sql);
      console.log('[migrate_complete OK]', sql.slice(0, 70));
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Duplicate') || msg.includes('already exists') || msg.includes('1060') || msg.includes('1061') || e.code === 'ER_DUP_FIELDNAME') {
        console.log('[migrate_complete SKIP]', sql.slice(0, 50));
      } else {
        console.error('[migrate_complete ERRO]', msg, '|', sql.slice(0, 60));
      }
    }
  }

  // Adicionar coluna business_id na tabela users se não existir
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
    if (e.code === 'ER_CANNOT_ADD_FOREIGN' || e.errno === 121) {
      console.log('FK users.business_id já existe ou erro de constraint duplicada.');
    } else {
      console.error('Erro ao adicionar FK users.business_id:', e.message);
    }
  }

  // Add last_seen and is_online columns for presence tracking (WhatsApp-like)
  const presenceColumns = [
    { name: 'last_seen', definition: 'TIMESTAMP NULL' },
    { name: 'is_online', definition: 'TINYINT(1) DEFAULT 0' },
    { name: 'last_seen_privacy', definition: "ENUM('everyone', 'contacts', 'nobody') DEFAULT 'everyone'" }
  ];

  for (const col of presenceColumns) {
    try {
      await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.definition}`);
      console.log(`Coluna users.${col.name} adicionada.`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`Coluna users.${col.name} já existe.`);
      } else {
        console.error(`Erro ao adicionar users.${col.name}:`, e.message);
      }
    }
  }

  // Run business platform migration
  try {
    const { migrateBusinessPlatform } = require('./migrate_business_platform');
    await migrateBusinessPlatform();
  } catch (e) {
    console.error('[migrate_business_platform ERRO]', e.message);
  }
}

if (require.main === module) {
  migrateComplete().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = migrateComplete;
