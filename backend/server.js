const express = require('express');
const cors = require('cors');
const http = require('http');

const authRoutes = require('./routes/authRoutes');
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

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rota de fallback
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API SENAI Connect Rodando (MVC) na porta 5000!' });
});

const PORT = 5000; // Alterado para 5000 pois a 3000 pode estar ocupada
server.listen(PORT, () => {
    console.log(`Servidor MVC rodando na porta ${PORT}`);

    // Start story cleanup cron job
    const io = socketHelper.getIO();
    startStoryCleanupCron(io);
});
