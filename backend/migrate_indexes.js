const db = require('./db');

async function migrateIndexes() {
  const indexes = [
    // Posts
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type VARCHAR(30) DEFAULT 'general' AFTER category`,
    `ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL`,
    // Users
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS unit VARCHAR(200) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS area VARCHAR(200) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS course VARCHAR(200) DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS links TEXT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS skills TEXT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE`,
    // Stories
    `ALTER TABLE stories ADD COLUMN IF NOT EXISTS expires_at DATETIME DEFAULT NULL`,
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(sender_id, receiver_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)`,
    `CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, status, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)`,
    `CREATE INDEX IF NOT EXISTS idx_users_unit ON users(unit)`,
    `CREATE INDEX IF NOT EXISTS idx_users_course ON users(course)`,
    // Reports table
    `CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id INT NOT NULL,
      target_type ENUM('post','comment','user') NOT NULL,
      target_id INT NOT NULL,
      reason VARCHAR(100) NOT NULL,
      description TEXT,
      status ENUM('pending','reviewed','dismissed') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    // Blocks table
    `CREATE TABLE IF NOT EXISTS blocks (
      blocker_id INT NOT NULL,
      blocked_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (blocker_id, blocked_id),
      FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    // Password reset
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ];

  for (const sql of indexes) {
    try {
      await db.query(sql);
      console.log('[OK]', sql.slice(0, 60));
    } catch (e) {
      // Many ALTERs will fail if column already exists — that's fine
      if (!e.message.includes('Duplicate') && !e.message.includes('already exists') && !e.message.includes('1060')) {
        console.error('[ERRO]', e.message, '|', sql.slice(0, 60));
      } else {
        console.log('[SKIP - já existe]', sql.slice(0, 60));
      }
    }
  }

  // Update existing stories to have expires_at
  await db.query(`UPDATE stories SET expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR) WHERE expires_at IS NULL`);
  console.log('[OK] Stories expires_at preenchido');
}

if (require.main === module) {
  migrateIndexes().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = migrateIndexes;
