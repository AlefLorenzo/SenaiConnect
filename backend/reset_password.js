const bcrypt = require('bcrypt');
const db = require('./db');

async function resetPassword() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, 'admin@senai.com']);
        console.log('Senha atualizada com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

resetPassword();