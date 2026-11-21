const db = require('../db');
const { supabaseAuthRequest } = require('../services/supabaseAuth');

const INSTITUTIONAL_EMAIL = /^[^\s@]+@(estudante|docente)\.senai\.com$/i;

async function findProfile(authUserId) {
    const [profiles] = await db.query(
        'SELECT id, auth_user_id, name, email, role, admin_role, avatar, bio, cover_image, state, city, unit, area, course, links, onboarding_completed, is_blocked FROM users WHERE auth_user_id = ?',
        [authUserId]
    );
    return profiles[0] || null;
}

function publicUser(profile) {
    return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        admin_role: profile.admin_role || null,
        avatar: profile.avatar,
        bio: profile.bio,
        cover_image: profile.cover_image,
        state: profile.state,
        city: profile.city,
        unit: profile.unit,
        area: profile.area,
        course: profile.course,
        links: profile.links,
        onboarding_completed: profile.onboarding_completed
    };
}

function sendAuthError(res, error, fallback) {
    const status = Number(error.status) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const message = error.message || fallback;
    return res.status(safeStatus).json({ error: message, code: error.code || undefined });
}

const authController = {
    register: async (req, res) => {
        try {
            const { name, email, password } = req.body || {};
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const normalizedName = String(name || '').trim();

            if (!normalizedName || !normalizedEmail || !password) {
                return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
            }
            if (!INSTITUTIONAL_EMAIL.test(normalizedEmail)) {
                return res.status(400).json({
                    error: 'Use seu e-mail institucional @estudante.senai.com ou @docente.senai.com.'
                });
            }
            if (String(password).length < 6) {
                return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
            }

            const authData = await supabaseAuthRequest('signup', {
                body: {
                    email: normalizedEmail,
                    password: String(password),
                    data: { full_name: normalizedName, name: normalizedName }
                }
            });

            const authUser = authData.user || (authData.id ? authData : null);
            const session = authData.session || (authData.access_token ? authData : null);
            const profile = authUser ? await findProfile(authUser.id) : null;

            if (authUser && !profile) {
                return res.status(503).json({
                    error: 'A conta foi criada no Supabase Auth, mas o perfil ainda não foi vinculado. Verifique o gatilho de cadastro antes de tentar novamente.'
                });
            }

            return res.status(201).json({
                message: session
                    ? 'Cadastro realizado com sucesso!'
                    : 'Cadastro iniciado. Confirme seu e-mail institucional para ativar a conta.',
                token: session ? session.access_token : null,
                session,
                user: profile ? publicUser(profile) : null,
                requiresEmailConfirmation: !session
            });
        } catch (error) {
            if (error.status === 400 && /already registered|already exists|user already/i.test(error.message)) {
                error.message = 'Este e-mail já possui uma conta no Supabase Auth. Tente entrar ou recuperar a senha.';
            }
            return sendAuthError(res, error, 'Erro ao cadastrar no Supabase Auth.');
        }
    },

    login: async (req, res) => {
        try {
            const { email, password } = req.body || {};
            const normalizedEmail = String(email || '').trim().toLowerCase();

            if (!normalizedEmail || !password) {
                return res.status(400).json({ error: 'Preencha e-mail e senha.' });
            }

            const session = await supabaseAuthRequest('token?grant_type=password', {
                body: { email: normalizedEmail, password: String(password) }
            });

            if (!session.access_token || !session.user || !session.user.id) {
                return res.status(502).json({ error: 'O Supabase não retornou uma sessão válida.' });
            }

            const profile = await findProfile(session.user.id);
            if (!profile) {
                return res.status(403).json({
                    error: 'A autenticação foi aceita, mas o perfil SENAI Connect não está vinculado. Entre em contato com o administrador.'
                });
            }
            if (profile.is_blocked) {
                return res.status(403).json({ error: 'Esta conta está bloqueada. Procure a administração da instituição.' });
            }

            return res.status(200).json({
                message: 'Login realizado com sucesso.',
                token: session.access_token,
                session,
                user: publicUser(profile)
            });
        } catch (error) {
            if (error.status === 400 || error.status === 401) {
                error.status = 401;
                if (/invalid login credentials/i.test(error.message)) {
                    error.message = 'E-mail ou senha incorretos. Contas antigas precisam ser ativadas no Supabase pelo cadastro com o mesmo e-mail institucional ou pela recuperação de senha.';
                } else if (/email not confirmed/i.test(error.message)) {
                    error.message = 'Confirme seu e-mail institucional antes de entrar.';
                }
            }
            return sendAuthError(res, error, 'Erro ao realizar login.');
        }
    },

    refresh: async (req, res) => {
        try {
            const refreshToken = req.body && req.body.refresh_token;
            if (!refreshToken) return res.status(400).json({ error: 'Token de renovação não fornecido.' });

            const session = await supabaseAuthRequest('token?grant_type=refresh_token', {
                body: { refresh_token: refreshToken }
            });
            if (!session.access_token || !session.refresh_token || !session.user || !session.user.id) {
                return res.status(502).json({ error: 'O Supabase não retornou uma sessão renovada válida.' });
            }

            const profile = await findProfile(session.user.id);
            if (!profile || profile.is_blocked) {
                return res.status(403).json({ error: 'A conta não está autorizada a acessar o SENAI Connect.' });
            }

            return res.json({
                token: session.access_token,
                session,
                user: publicUser(profile)
            });
        } catch (error) {
            return sendAuthError(res, error, 'Não foi possível renovar a sessão.');
        }
    },

    logout: async (req, res) => {
        try {
            const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
            if (token) {
                await supabaseAuthRequest('logout', { accessToken: token });
            }
            return res.status(204).end();
        } catch (error) {
            // A sessão local também será removida pelo frontend; a expiração do access token
            // continua protegendo a API mesmo quando a rede está indisponível.
            return res.status(error.status || 503).json({ error: error.message || 'Não foi possível encerrar a sessão no Supabase.' });
        }
    },

    me: async (req, res) => {
        try {
            const [users] = await db.query(
                'SELECT id, name, email, role, admin_role, avatar, bio, cover_image, state, city, unit, area, course, links, onboarding_completed, is_blocked FROM users WHERE id = ?',
                [req.user.id]
            );
            if (users.length === 0) return res.status(404).json({ error: 'Perfil SENAI Connect não encontrado.' });
            if (users[0].is_blocked) return res.status(403).json({ error: 'Esta conta está bloqueada.' });
            return res.status(200).json(publicUser(users[0]));
        } catch (error) {
            console.error('Erro ao carregar perfil autenticado:', error);
            return res.status(500).json({ error: 'Erro interno ao carregar o perfil.' });
        }
    }
};

module.exports = authController;
