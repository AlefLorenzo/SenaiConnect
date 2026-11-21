const db = require('./db');
const bcrypt = require('bcrypt');

const courses = [
  'Desenvolvimento de Sistemas', 'Redes de Computadores', 'Eletrotécnica', 
  'Eletrônica', 'Mecânica', 'Mecatrônica', 'Administração', 'Logística', 
  'Marketing', 'Design Gráfico', 'Automação Industrial', 'Edificações'
];

const postContents = [
  "Muito feliz com o resultado do meu projeto final!",
  "Alguém sabe como resolver esse erro no React?",
  "Dica do dia: sempre versionem seus códigos com Git.",
  "Estou procurando parcerias para um projeto de IoT.",
  "Hoje a aula de robótica foi incrível, aprendi muito.",
  "Recomendo a todos estudarem Python, tem muitas oportunidades.",
  "Terminei mais um curso extra de gestão, bora focar na carreira.",
  "Dúvida rápida: qual melhor banco de dados para um app de chat?",
  "Compartilhando meu portfólio atualizado, dêem uma olhada!",
  "Sexta-feira de muito estudo e foco no TCC."
];

async function run() {
  try {
    // 1. Update schema
    console.log("Adicionando is_private em users...");
    try {
      await db.query("ALTER TABLE users ADD COLUMN is_private TINYINT(1) DEFAULT 0");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    console.log("Adicionando is_edited em messages...");
    try {
      await db.query("ALTER TABLE messages ADD COLUMN is_edited TINYINT(1) DEFAULT 0");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    // 2. Seed Users
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('senha123', salt);

    console.log("Criando 30 usuários e suas postagens...");
    for (let i = 1; i <= 30; i++) {
      const name = `Usuário Teste ${i}`;
      const email = `teste${i}@estudante.senai.com`;
      const course = courses[i % courses.length];
      const isPrivate = i % 4 === 0 ? 1 : 0; // Every 4th user is private

      const [res] = await db.query(
        `INSERT INTO users (name, email, password_hash, course, is_private, onboarding_completed, avatar)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [name, email, hash, course, isPrivate, `https://ui-avatars.com/api/?name=User+${i}&background=random`]
      );
      
      const userId = res.insertId;

      // 3. Seed Posts
      for (let j = 0; j < 2; j++) {
        const content = postContents[(i + j) % postContents.length];
        await db.query(
          `INSERT INTO posts (user_id, content, post_type) VALUES (?, ?, 'general')`,
          [userId, content]
        );
      }
    }
    
    console.log("Concluído!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
