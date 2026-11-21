const db = require('../db');

async function migrate() {
    try {
        console.log('Starting story enhancements migration...');

        // 1. story_reactions table - for emoji reactions to stories
        await db.query(`
            CREATE TABLE IF NOT EXISTS story_reactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                story_id INT NOT NULL,
                user_id INT NOT NULL,
                reaction_type ENUM('heart', 'laugh', 'wow', 'sad', 'angry', 'clap', 'pray', 'fire') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_story_user_reaction (story_id, user_id, reaction_type),
                INDEX idx_story_reactions_story (story_id),
                INDEX idx_story_reactions_user (user_id)
            )
        `);
        console.log('Created story_reactions table');

        // 2. story_replies table - for replies to stories (integrates with messages)
        await db.query(`
            CREATE TABLE IF NOT EXISTS story_replies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                story_id INT NOT NULL,
                user_id INT NOT NULL,
                content TEXT NOT NULL,
                message_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
                INDEX idx_story_replies_story (story_id),
                INDEX idx_story_replies_user (user_id),
                INDEX idx_story_replies_message (message_id)
            )
        `);
        console.log('Created story_replies table');

        // 3. story_privacy_exceptions table - for "My contacts except..." and "Share only with..."
        await db.query(`
            CREATE TABLE IF NOT EXISTS story_privacy_exceptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                story_id INT NOT NULL,
                user_id INT NOT NULL,
                exception_type ENUM('exclude', 'include') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_story_user_exception (story_id, user_id),
                INDEX idx_story_privacy_exceptions_story (story_id),
                INDEX idx_story_privacy_exceptions_user (user_id)
            )
        `);
        console.log('Created story_privacy_exceptions table');

        // 4. Add columns to stories table for enhanced features
        const storyColumns = [
            { name: 'background_color', definition: 'VARCHAR(7) DEFAULT NULL' }, // For text stories
            { name: 'text_overlay_data', definition: 'JSON DEFAULT NULL' }, // For text/emoji positioning on media
            { name: 'reply_count', definition: 'INT DEFAULT 0' },
            { name: 'reaction_count', definition: 'INT DEFAULT 0' },
        ];

        for (const col of storyColumns) {
            try {
                await db.query(`ALTER TABLE stories ADD COLUMN ${col.name} ${col.definition}`);
                console.log(`Added column stories.${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column stories.${col.name} already exists.`);
                } else throw err;
            }
        }

        // 5. Add columns to story_views for enhanced tracking
        const viewColumns = [
            { name: 'viewed_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }, // Already exists but ensure
        ];

        for (const col of viewColumns) {
            try {
                await db.query(`ALTER TABLE story_views ADD COLUMN ${col.name} ${col.definition}`);
                console.log(`Added column story_views.${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column story_views.${col.name} already exists.`);
                } else throw err;
            }
        }

        // 6. Create index for story_views viewed_at for performance
        try {
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_story_views_viewed_at ON story_views(viewed_at)
            `);
            console.log('Created index on story_views.viewed_at');
        } catch (err) {
            console.log('Index on story_views.viewed_at already exists or error:', err.message);
        }

        // 7. Add settings for story privacy default to users table
        try {
            await db.query(`
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS story_privacy_default ENUM('public', 'followers', 'close_friends') DEFAULT 'public'
            `);
            console.log('Added story_privacy_default column to users');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column users.story_privacy_default already exists.');
            } else throw err;
        }

        console.log('\nMigration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();