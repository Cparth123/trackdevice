require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const logger = require('./config/logger');
const deviceRoutes = require('./routes/devices');
const sessionRoutes = require('./routes/sessions');
const { initializeSignaling } = require('./socket/signaling');

const app = express();
const httpServer = http.createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://trackdevice-web.vercel.app')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log('Allowed origins:', allowedOrigins);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.log(`Origin not allowed: ${origin}`);
      return callback(null, true); // Temporarily allow all for debugging
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ICE servers endpoint
app.get('/api/ice-servers', (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({ iceServers });
});

// Quick device check endpoint (helpful for debugging)
app.get('/api/device-check/:deviceId', async (req, res) => {
  try {
    const Device = require('./models/Device');
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    res.json({
      exists: !!device,
      device: device ? device.toPublicJSON() : null,
      message: device ? 'Device found' : 'Device not found in database'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes
app.use('/api/devices', deviceRoutes);
app.use('/api/sessions', sessionRoutes);

// Error handling
app.use((error, req, res, next) => {
  logger.error(error.stack || error.message);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 30000,
});

async function start() {
  await connectDB();
  await initializeSignaling(io);

  const port = Number(process.env.PORT || 4000);
  httpServer.listen(port, () => {
    logger.info(`Backend listening on ${port}`);
    logger.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
  });
}

start().catch((error) => {
  logger.error(`Startup failed: ${error.message}`);
  process.exit(1);
});