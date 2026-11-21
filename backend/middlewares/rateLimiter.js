// Rate limiter implementation without external dependencies (pure Node.js Map-based)

class RateLimiter {
    constructor(maxRequests, windowMs, message) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.message = message;
        this.store = new Map();

        // Cleanup old entries every 5 minutes
        setInterval(() => this._cleanup(), 5 * 60 * 1000);
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, data] of this.store.entries()) {
            if (now - data.startTime > this.windowMs) {
                this.store.delete(key);
            }
        }
    }

    middleware() {
        return (req, res, next) => {
            // Skip rate limiting for OPTIONS (CORS preflight) requests
            if (req.method === 'OPTIONS') {
                return next();
            }

            const key = req.ip || req.connection.remoteAddress || 'unknown';
            const now = Date.now();
            const data = this.store.get(key);

            if (!data || (now - data.startTime > this.windowMs)) {
                this.store.set(key, { count: 1, startTime: now });
                console.log(`[RateLimiter] New key: ${key}, count: 1, max: ${this.maxRequests}, window: ${this.windowMs}ms`);
                return next();
            }

            if (data.count >= this.maxRequests) {
                console.log(`[RateLimiter] LIMIT EXCEEDED: key: ${key}, count: ${data.count}, max: ${this.maxRequests}`);
                return res.status(429).json({ error: this.message });
            }

            data.count++;
            console.log(`[RateLimiter] key: ${key}, count: ${data.count}/${this.maxRequests}`);
            next();
        };
    }
}

const loginLimiter = new RateLimiter(8, 15 * 60 * 1000, 'Muitas tentativas de login. Aguarde 15 minutos.').middleware();
const registerLimiter = new RateLimiter(10, 60 * 60 * 1000, 'Muitos cadastros deste IP. Aguarde 1 hora.').middleware();
const apiLimiter = new RateLimiter(100000, 15 * 60 * 1000, 'Muitas requisições. Aguarde alguns minutos.').middleware();
const messageLimiter = new RateLimiter(120, 60 * 60 * 1000, 'Limite de mensagens atingido. Aguarde.').middleware();
const postLimiter = new RateLimiter(40, 60 * 60 * 1000, 'Você publicou muitos posts. Aguarde.').middleware();

module.exports = { loginLimiter, registerLimiter, apiLimiter, messageLimiter, postLimiter };
