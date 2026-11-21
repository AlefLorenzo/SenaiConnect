const mysql = require('mysql2/promise');

async function test() {
    const db = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'redesocial'
    });
    
    const loggedUserId = 1; // Change as needed

    const query = `
        SELECT 
            u.id, u.name, u.avatar, u.role,
            MAX(c.id) as conversation_id,
            (SELECT m.content FROM messages m WHERE m.conversation_id = MAX(c.id) ORDER BY m.created_at DESC LIMIT 1) as last_message,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = MAX(c.id) AND m.receiver_id = ? AND m.status IN ('enviada', 'sent', 'delivered')) as unread_count,
            (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = MAX(c.id)) as last_interaction
        FROM users u
        LEFT JOIN conversation_participants cp_other ON cp_other.user_id = u.id
        LEFT JOIN conversation_participants cp_me ON cp_me.conversation_id = cp_other.conversation_id AND cp_me.user_id = ?
        LEFT JOIN conversations c ON c.id = cp_me.conversation_id
        WHERE u.id != ? AND (
            c.id IS NOT NULL 
            OR EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = u.id)
        )
        GROUP BY u.id
        ORDER BY last_interaction DESC, u.name ASC
    `;

    const [rows] = await db.query(query, [
        loggedUserId, 
        loggedUserId, 
        loggedUserId, 
        loggedUserId
    ]);
    
    console.log(rows);
    process.exit(0);
}

test();
