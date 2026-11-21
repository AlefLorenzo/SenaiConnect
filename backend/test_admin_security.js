require('dotenv').config();
const http = require('http');

const API_URL = 'http://localhost:5000';

let passedTests = 0;
let failedTests = 0;

async function request(method, path, body = null, token = null) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost',
            port: 5000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };
        const req = http.request(opts, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: {} }); }
            });
        });
        req.on('error', () => resolve({ status: 0, body: {} }));
        if (data) req.write(data);
        req.end();
    });
}

function pass(label) {
    console.log(`✅ PASS: ${label}`);
    passedTests++;
}

function fail(label, expected, got) {
    console.error(`❌ FAIL: ${label} | expected status ${expected}, got ${got}`);
    failedTests++;
}

async function runTests() {
    console.log('\n======= TESTES DE SEGURANÇA - PAINEL ADM =======\n');

    let socialToken = null;
    let adminToken = null;

    // --- Prerequisito: Logar como aluno para ter token social ---
    const loginRes = await request('POST', '/api/auth/login', { email: 'alice@seed.com', password: '123456' });
    if (loginRes.status === 200 && loginRes.body.token) {
        socialToken = loginRes.body.token;
        console.log(`[Setup] Token social obtido para ${loginRes.body.user?.email || 'aluno'}`);
    } else {
        // Tentar com outro usuário seed
        const db = require('./db');
        const bcrypt = require('bcrypt');
        const [users] = await db.query("SELECT email FROM users WHERE admin_role IS NULL LIMIT 1");
        const email = users[0]?.email;
        if (email) {
            await db.query("UPDATE users SET password_hash = ? WHERE email = ?", [await bcrypt.hash('123456', 10), email]);
            const r2 = await request('POST', '/api/auth/login', { email, password: '123456' });
            if (r2.status === 200) {
                socialToken = r2.body.token;
                console.log(`[Setup] Token social obtido para ${email}`);
            }
        }
        await db.end?.();
    }

    // Teste 1 — Token inválido
    const t1 = await request('GET', '/api/admin/dashboard', null, 'token_invalido_qualquer');
    t1.status === 403 || t1.status === 401 ? pass('Teste 1: Token inválido → 401/403') : fail('Teste 1: Token inválido', '401 ou 403', t1.status);

    // Teste 2 — Sem token
    const t2 = await request('GET', '/api/admin/dashboard');
    t2.status === 401 ? pass('Teste 2: Sem token → 401') : fail('Teste 2: Sem token', 401, t2.status);

    // Teste 3 — Token social não acessa admin
    if (socialToken) {
        const t3 = await request('GET', '/api/admin/dashboard', null, socialToken);
        t3.status === 403 ? pass('Teste 3: Token social → 403 (type !== admin)') : fail('Teste 3: Token social', 403, t3.status);
    } else {
        console.warn('⚠️ Teste 3 ignorado: Token social não disponível');
    }

    // Teste 4 — Login admin com senha errada
    const t4 = await request('POST', '/api/admin/login', { email: 'admin@senai.com', password: 'senha_errada_total' });
    t4.status === 401 ? pass('Teste 4: Login com senha errada → 401') : fail('Teste 4: Senha errada', 401, t4.status);

    // Teste 4b — Mensagem genérica (não deve revelar usuário/senha separadamente)
    if (t4.body && t4.body.error) {
        const msg = t4.body.error.toLowerCase();
        !msg.includes('usuário') && !msg.includes('senha incorreta')
            ? pass('Teste 4b: Mensagem de erro genérica (sem enumeração)')
            : fail('Teste 4b: Mensagem de erro REVELA detalhes', 'mensagem genérica', msg);
    }

    // Teste 5 — Login admin com credenciais corretas
    const t5 = await request('POST', '/api/admin/login', { email: 'admin@senai.com', password: '123456' });
    if (t5.status === 200 && t5.body.token) {
        adminToken = t5.body.token;
        pass('Teste 5: Login admin válido → 200 + token');
        // Verificar payload
        const parts = t5.body.token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        payload.type === 'admin' ? pass('Teste 5a: type === "admin" no payload') : fail('Teste 5a: type no payload', 'admin', payload.type);
        payload.admin_role === 'super_admin' ? pass('Teste 5b: admin_role no payload') : fail('Teste 5b: admin_role no payload', 'super_admin', payload.admin_role);
        // Verificar que não tem dados sensíveis no payload
        !payload.password && !payload.password_hash
            ? pass('Teste 5c: Sem dados sensíveis no token')
            : fail('Teste 5c: Token contém dados sensíveis!', 'nenhum', 'password/hash');
    } else {
        fail('Teste 5: Login admin válido', 200, t5.status);
        console.log('  Detalhe:', t5.body);
    }

    // Teste 6 — Dashboard com token admin válido
    if (adminToken) {
        const t6 = await request('GET', '/api/admin/dashboard', null, adminToken);
        t6.status === 200 ? pass('Teste 6: Dashboard com admin token → 200') : fail('Teste 6: Dashboard admin', 200, t6.status);
    }

    // Teste 7 — Rate Limit (5 tentativas falhas devem bloquear a 6ª)
    console.log('\n[Rate Limit] Executando 6 tentativas inválidas...');
    let blocked = false;
    for (let i = 1; i <= 6; i++) {
        const r = await request('POST', '/api/admin/login', { email: 'test@rate.com', password: 'wrong' });
        if (r.status === 429) {
            blocked = true;
            console.log(`  Bloqueio aplicado na tentativa ${i}`);
            break;
        }
    }
    blocked ? pass('Teste 7: Rate Limit bloqueia após exceder tentativas → 429') : fail('Teste 7: Rate Limit', '429 após 5 falhas', 'nunca bloqueou');

    // Teste 8 — Verificar log de auditoria no banco via conexão separada
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'redesocial'
    });
    const [logs] = await conn.query("SELECT * FROM admin_logs WHERE action IN ('ADMIN_LOGIN_SUCCESS','ADMIN_LOGIN_FAILED') ORDER BY created_at DESC LIMIT 5");
    await conn.end();

    logs.length > 0 ? pass(`Teste 8: Auditoria → ${logs.length} log(s) encontrado(s)`) : fail('Teste 8: Auditoria', 'logs existentes', 'nenhum log');
    
    if (logs.length > 0) {
        logs[0].ip_address ? pass('Teste 8a: IP capturado no log') : fail('Teste 8a: IP no log', 'ip_address preenchido', 'null');
        const hasSensitive = JSON.stringify(logs[0]).toLowerCase();
        !hasSensitive.includes('password') && !hasSensitive.includes('token') 
            ? pass('Teste 8b: Log não contém dados sensíveis')
            : fail('Teste 8b: Log contém dados sensíveis!', 'nenhum', 'password/token');
    }

    console.log(`\n======= RESULTADO: ${passedTests} PASSARAM / ${failedTests} FALHARAM =======\n`);
    process.exit(failedTests > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Erro ao executar testes:', err);
    process.exit(1);
});
