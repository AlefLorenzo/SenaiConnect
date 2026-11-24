const { supabaseAuthRequest } = require('../services/supabaseAuth');

const passwordController = {
  forgotPassword: async (req, res) => {
    try {
      const email = String((req.body && req.body.email) || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' });

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
      const redirectTo = encodeURIComponent(frontendUrl + '/reset-password');

      await supabaseAuthRequest('recover?redirect_to=' + redirectTo, {
        body: { email }
      });

      return res.status(200).json({
        message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
      });
    } catch (error) {
      console.error('Erro ao solicitar recuperação no Supabase Auth:', error);
      if (error.status === 429) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde antes de solicitar outro link.' });
      }
      if (error.status === 503) {
        return res.status(503).json({ error: error.message });
      }
      return res.status(200).json({
        message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
      });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const token = String((req.body && (req.body.accessToken || req.body.token)) || '').trim();
      const newPassword = String((req.body && req.body.newPassword) || '');

      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Link de recuperação e nova senha são obrigatórios.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      }

      await supabaseAuthRequest('user', {
        method: 'PUT',
        accessToken: token,
        body: { password: newPassword }
      });

      return res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
      console.error('Erro ao redefinir senha no Supabase Auth:', error);
      const status = error.status === 401 || error.status === 403 || error.status === 422
        ? 400
        : (error.status || 500);
      return res.status(status).json({
        error: status === 400
          ? 'Link de recuperação inválido ou expirado. Solicite um novo link.'
          : (error.message || 'Erro ao redefinir senha.')
      });
    }
  }
};

module.exports = passwordController;
