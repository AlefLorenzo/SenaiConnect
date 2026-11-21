const db = require('./db');

async function runMigration() {
  console.log('Iniciando migração do banco de dados...');
  try {
    // ─── 1. Extensões na tabela users ───────────────────────────────────────
    console.log('Adicionando colunas na tabela users...');
    const userColumns = [
      { name: 'cover_image', definition: 'VARCHAR(255) DEFAULT NULL' },
      { name: 'state',       definition: "VARCHAR(100) DEFAULT 'São Paulo'" },
      { name: 'city',        definition: "VARCHAR(100) DEFAULT 'São Paulo'" },
      { name: 'unit',        definition: "VARCHAR(150) DEFAULT 'Unidade Centro'" },
      { name: 'area',        definition: 'VARCHAR(150) DEFAULT NULL' },
      { name: 'course',      definition: 'VARCHAR(150) DEFAULT NULL' },
      { name: 'links',       definition: 'TEXT DEFAULT NULL' },
    ];
    for (const col of userColumns) {
      try {
        await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`Coluna users.${col.name} adicionada.`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Coluna users.${col.name} já existe. Ignorando.`);
        } else throw err;
      }
    }

    // ─── 2. Tabela stories ───────────────────────────────────────────────────
    console.log('Criando/verificando tabela stories...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT NOT NULL,
        media_url    VARCHAR(500) DEFAULT NULL,
        media_type   VARCHAR(50)  DEFAULT 'image',
        text_content TEXT         DEFAULT NULL,
        expires_at   DATETIME     DEFAULT NULL,
        created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    const storyColumns = [
      { name: 'text_content', definition: 'TEXT DEFAULT NULL' },
      { name: 'expires_at',   definition: 'DATETIME DEFAULT NULL' },
    ];
    for (const col of storyColumns) {
      try {
        await db.query(`ALTER TABLE stories ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`Coluna stories.${col.name} adicionada.`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Coluna stories.${col.name} já existe. Ignorando.`);
        } else throw err;
      }
    }
    try {
      await db.query(`ALTER TABLE stories MODIFY COLUMN media_url VARCHAR(500) DEFAULT NULL`);
    } catch (_) {}
    console.log('Tabela stories OK.');

    // ─── 3. Tabela notifications (Enhanced for Activity Center) ──────────────
    console.log('Criando/verificando tabela notifications...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        user_id         INT NOT NULL,
        activity_type   VARCHAR(50) NOT NULL DEFAULT 'notification',
        type            VARCHAR(50) NOT NULL,  -- legacy compatibility
        sender_id       INT NOT NULL,
        content         TEXT,
        reference_type  VARCHAR(50) DEFAULT NULL,  -- 'post', 'comment', 'story', 'follow', 'group', 'event', 'message', 'notice'
        reference_id    INT DEFAULT NULL,
        grouping_id     VARCHAR(100) DEFAULT NULL,  -- for grouping repeated activities
        metadata        JSON DEFAULT NULL,          -- additional flexible data
        status          VARCHAR(50) DEFAULT 'unread', -- 'unread', 'read'
        read_at         TIMESTAMP NULL DEFAULT NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_created (user_id, created_at DESC),
        INDEX idx_user_status (user_id, status),
        INDEX idx_grouping (grouping_id),
        INDEX idx_activity_type (activity_type)
      )
    `);

    // Add new columns if table exists from previous migration
    const notificationColumns = [
      { name: 'activity_type', definition: "VARCHAR(50) NOT NULL DEFAULT 'notification'" },
      { name: 'reference_type', definition: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'grouping_id', definition: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'metadata', definition: 'JSON DEFAULT NULL' },
      { name: 'read_at', definition: 'TIMESTAMP NULL DEFAULT NULL' },
    ];
    for (const col of notificationColumns) {
      try {
        await db.query(`ALTER TABLE notifications ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`Coluna notifications.${col.name} adicionada.`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Coluna notifications.${col.name} já existe. Ignorando.`);
        } else throw err;
      }
    }

    // Add indexes for performance
    const indexes = [
      { name: 'idx_user_created', def: 'INDEX idx_user_created (user_id, created_at DESC)' },
      { name: 'idx_user_status', def: 'INDEX idx_user_status (user_id, status)' },
      { name: 'idx_grouping', def: 'INDEX idx_grouping (grouping_id)' },
      { name: 'idx_activity_type', def: 'INDEX idx_activity_type (activity_type)' },
    ];
    for (const idx of indexes) {
      try {
        await db.query(`ALTER TABLE notifications ADD ${idx.def}`);
        console.log(`Índice notifications.${idx.name} adicionado.`);
      } catch (err) {
        // Ignore duplicate key errors
        if (err.code !== 'ER_DUP_KEYNAME') throw err;
      }
    }
    console.log('Tabela notifications OK (Activity Center ready).');

    // ─── 3b. Tabelas de interações de Stories ──────────────────────────────
    console.log('Criando/verificando tabelas de interações de stories...');

    // Story Reactions
    await db.query(`
      CREATE TABLE IF NOT EXISTS story_reactions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        story_id     INT NOT NULL,
        user_id      INT NOT NULL,
        reaction_type VARCHAR(20) NOT NULL,  -- 'heart', 'fire', 'thumbs_up', 'clap', 'laugh', 'surprise', 'sad', 'angry'
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_story_user_reaction (story_id, user_id, reaction_type)
      )
    `);
    console.log('Tabela story_reactions OK.');

    // Story Replies (DM replies to stories)
    await db.query(`
      CREATE TABLE IF NOT EXISTS story_replies (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        story_id     INT NOT NULL,
        sender_id    INT NOT NULL,
        content      TEXT NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Tabela story_replies OK.');

    // Story Views
    await db.query(`
      CREATE TABLE IF NOT EXISTS story_views (
        story_id     INT NOT NULL,
        user_id      INT NOT NULL,
        viewed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (story_id, user_id),
        FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Tabela story_views OK.');

    // ─── 4. Tabela saved_posts (FALTAVA!) ────────────────────────────────────
    console.log('Criando/verificando tabela saved_posts...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS saved_posts (
        post_id    INT NOT NULL,
        user_id    INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Tabela saved_posts OK.');

    // ─── 5. Coluna group_id em posts (FALTAVA!) ──────────────────────────────
    console.log('Adicionando group_id em posts...');
    try {
      await db.query(`ALTER TABLE posts ADD COLUMN group_id INT DEFAULT NULL`);
      console.log('Coluna posts.group_id adicionada.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Coluna posts.group_id já existe. Ignorando.');
      } else throw err;
    }

    // ─── 6. Colunas de mídia em messages ────────────────────────────────────
    console.log('Adicionando colunas de mídia em messages...');
    const msgColumns = [
      { name: 'message_type',    definition: "VARCHAR(20) DEFAULT 'text'" },
      { name: 'media_url',       definition: 'VARCHAR(500) DEFAULT NULL' },
      { name: 'attachment_name', definition: 'VARCHAR(255) DEFAULT NULL' },
    ];
    for (const col of msgColumns) {
      try {
        await db.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`Coluna messages.${col.name} adicionada.`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`Coluna messages.${col.name} já existe. Ignorando.`);
        } else throw err;
      }
    }

    console.log('\n✅ Migração concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao rodar migração:', error);
  } finally {
    process.exit(0);
  }
}

runMigration();
