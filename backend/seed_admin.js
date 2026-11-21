require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcrypt');

async function run() {
    try {
        console.log("Iniciando seed administrativo...");

        const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@senai.com';
        const adminPassword = process.env.ADMIN_SEED_PASSWORD || '123456';
        
        // Em produção, nunca deve usar fallback. Aqui validamos para avisar.
        if (adminEmail === 'admin@senai.com' && process.env.NODE_ENV === 'production') {
            console.error("ERRO CRÍTICO: Tentativa de usar credenciais hardcoded em produção!");
            process.exit(1);
        }

        const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [adminEmail]);

        if (existingUser.length > 0) {
            console.log("O e-mail do admin já existe. Promovendo usuário a super_admin...");
            await db.query("UPDATE users SET admin_role = 'super_admin', role = 'Administrador' WHERE email = ?", [adminEmail]);
        } else {
            console.log("Criando novo super_admin...");
            const hash = await bcrypt.hash(adminPassword, 10);
            await db.query(`
                INSERT INTO users (name, email, password_hash, role, admin_role, onboarding_completed)
                VALUES ('Super Administrador', ?, ?, 'Administrador', 'super_admin', 1)
            `, [adminEmail, hash]);
        }

        console.log("Seed administrativo concluído com sucesso!");
        process.exit(0);
    } catch (err) {
        console.error("Erro no seed administrativo:", err);
        process.exit(1);
    }
}

run();
