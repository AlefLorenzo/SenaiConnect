// rateLimiter em memória para não depender do express-rate-limit

const attempts = new Map();

function rateLimiter({ windowMs, max, message, keyGenerator }) {
    return (req, res, next) => {
        // Usa keyGenerator customizado se fornecido, senão usa apenas IP
        const ip = req.ip || req.connection.remoteAddress;
        const key = keyGenerator ? keyGenerator(req) : ip;
        const now = Date.now();

        if (!attempts.has(key)) {
            attempts.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const data = attempts.get(key);

        // Se o tempo da janela já passou, reseta a contagem
        if (now > data.resetTime) {
            attempts.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        // Se estiver dentro da janela e passou o limite, bloqueia
        if (data.count >= max) {
            return res.status(429).json({ error: message || 'Muitas requisições. Tente novamente mais tarde.' });
        }

        // Incrementa a contagem e prossegue
        data.count += 1;
        attempts.set(key, data);
        next();
    };
}

module.exports = rateLimiter;
