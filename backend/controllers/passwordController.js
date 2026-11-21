const db = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
// const nodemailer = require('nodemailer'); // In a real app we'd send an email

const passwordController = {
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'E-mail é obrigatório' });

      const [users] = await db.query('SELECT id, name FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        // Return 200 even if not found to prevent email enumeration
        return res.status(200).json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
      }

      const user = users[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await db.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, token, expiresAt]
      );

      // In a real application, send the email here using nodemailer
      /*
      const transporter = nodemailer.createTransport({ ... });
      await transporter.sendMail({
        to: email,
        subject: 'Recuperação de Senha - SENAI Connect',
        html: `<p>Clique no link para resetar sua senha: <a href="http://localhost:5173/reset-password?token=${token}">Resetar Senha</a></p>`
      });
      */
      
      console.log(`[SIMULATED EMAIL TO ${email}] Link de reset: http://localhost:5173/reset-password?token=${token}`);

      res.status(200).json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
    } catch (error) {
      console.error('Erro no forgotPassword:', error);
      res.status(500).json({ error: 'Erro ao processar solicitação.' });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      }

      const [tokens] = await db.query(
        'SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()',
        [token]
      );

      if (tokens.length === 0) {
        return res.status(400).json({ error: 'Token inválido ou expirado.' });
      }

      const resetRequest = tokens[0];
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, resetRequest.user_id]);

      // Mark token as used
      await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [resetRequest.id]);

      res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
      console.error('Erro no resetPassword:', error);
      res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
  }
};

module.exports = passwordController;
