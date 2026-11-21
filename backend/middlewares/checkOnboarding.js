const db = require('../db');

const checkOnboarding = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        const [[user]] = await db.query('SELECT onboarding_completed FROM users WHERE id = ?', [userId]);
        
        if (!user || user.onboarding_completed === 0) {
            return res.status(403).json({ 
                error: 'Onboarding não concluído.', 
                code: 'ONBOARDING_REQUIRED' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Erro ao verificar onboarding:', error);
        res.status(500).json({ error: 'Erro interno ao validar estado do usuário.' });
    }
};

module.exports = { checkOnboarding };
