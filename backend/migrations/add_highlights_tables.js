const db = require('../db');

async function migrate() {
    try {
        console.log('Starting highlights tables migration...');

        // Create highlights table
        await db.query(`
            CREATE TABLE IF NOT EXISTS highlights (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(100) NOT NULL,
                cover_url VARCHAR(500) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_highlights_user (user_id)
            )
        `);
        console.log('Created highlights table');

        // Create highlight_stories table (junction table)
        await db.query(`
            CREATE TABLE IF NOT EXISTS highlight_stories (
                highlight_id INT NOT NULL,
                story_id INT NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (highlight_id, story_id),
                FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE,
                FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
            )
        `);
        console.log('Created highlight_stories table');

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();