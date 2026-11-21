const express = require('express');
const cors = require('cors');
const http = require('http');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const postRoutes = require('./routes/postRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const messageRoutes = require('./routes/messageRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const storyRoutes = require('./routes/storyRoutes');
const highlightRoutes = require('./routes/highlightRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const businessRoutes = require('./routes/businessRoutes');
const engagementRoutes = require('./routes/engagementRoutes');
const followRoutes = require('./routes/followRoutes');
const friendRoutes = require('./routes/friendRoutes');
const matchRoutes = require('./routes/matchRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const searchRoutes = require('./routes/searchRoutes');
const publicRoutes = require('./routes/publicRoutes');
const path = require('path');

const socketHelper = require('./socketHelper');
const { startStoryCleanupCron } = require('./utils/storyCleanup');

const app = express();
const server = http.createServer(app);

// Inicializa o Socket.io
socketHelper.init(server);

// CORS - Allow multiple frontend ports for development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:5179',
  'http://localhost:5180',
  'http://localhost:5181',
  'http://localhost:5182',
  'http://localhost:5183',
  'http://localhost:5184',
  'http://localhost:5185',
  'http://localhost:5186',
  'http://localhost:5187',
  'http://localhost:5188',
  'http://localhost:5189',
  'http://localhost:5190',
  'http://localhost:5191',
  'http://localhost:5192',
  'http://localhost:5193',
  'http://localhost:5194',
  'http://localhost:5195',
  'http://localhost:5196',
  'http://localhost:5197',
  'http://localhost:5198',
  'http://localhost:5199',
  'http://localhost:5200',
  'http://localhost:5201',
  'http://localhost:5202',
  'http://localhost:5203',
  'http://localhost:5204',
  'http://localhost:5205',
  'http://localhost:5206',
  'http://localhost:5207',
  'http://localhost:5208',
  'http://localhost:5209',
];

const configuredOrigins = [
  ...(process.env.FRONTEND_URL || '').split(','),
  ...(process.env.FRONTEND_URLS || '').split(',')
].map((value) => value.trim()).filter(Boolean);
const allowedOriginSet = new Set([...allowedOrigins, ...configuredOrigins]);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOriginSet.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/stories', highlightRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/search', searchRoutes);

// Public read-only listings use the existing /api/events and /api/courses paths.
app.use('/api', publicRoutes);
app.use('/api', engagementRoutes);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rota de fallback
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API SENAI Connect Rodando (MVC) na porta 5000!' });
});

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => {
    console.log(`Servidor MVC rodando na porta ${PORT}`);

    // Start story cleanup cron job
    const io = socketHelper.getIO();
    startStoryCleanupCron(io);
});
