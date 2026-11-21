const db = require('../db');

async function migrate() {
    try {
        console.log('Starting privacy columns migration...');

        // Add privacy_showProfile column
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS privacy_showProfile ENUM('public', 'professor', 'private') DEFAULT 'public'
        `);
        console.log('Added privacy_showProfile column');

        // Add privacy_showEmail column (using different name than hide_email for clarity)
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS privacy_showEmail BOOLEAN DEFAULT FALSE
        `);
        console.log('Added privacy_showEmail column');

        // Add settings JSON column for user preferences
        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS settings JSON
        `);
        console.log('Added settings column');

        // Add privacy column to stories table if not exists (for story-specific privacy)
        await db.query(`
            ALTER TABLE stories
            ADD COLUMN IF NOT EXISTS privacy ENUM('public', 'followers', 'close_friends') DEFAULT 'public'
        `);
        console.log('Added privacy column to stories');

        // Create index for privacy filtering performance
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_users_privacy_profile ON users(privacy_showProfile)
        `);
        console.log('Created index on privacy_showProfile');

        // Migrate existing is_private data to privacy_showProfile
        await db.query(`
            UPDATE users
            SET privacy_showProfile = CASE
                WHEN is_private = 1 THEN 'private'
                ELSE 'public'
            END
            WHERE privacy_showProfile = 'public' OR privacy_showProfile IS NULL
        `);
        console.log('Migrated is_private data to privacy_showProfile');

        // Migrate existing hide_email data to privacy_showEmail
        await db.query(`
            UPDATE users
            SET privacy_showEmail = (hide_email = 0)
            WHERE privacy_showEmail IS NULL OR privacy_showEmail = FALSE
        `);
        console.log('Migrated hide_email data to privacy_showEmail');

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();