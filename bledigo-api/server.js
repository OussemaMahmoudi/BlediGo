/**
 * ╔══════════════════════════════════════════════════════╗
 * ║          BlediGo API  –  server.js                   ║
 * ║  Express + MongoDB + JWT  |  Node ≥ 18              ║
 * ╚══════════════════════════════════════════════════════╝
 */

'use strict';

require('dotenv').config();

const validateEnv = require('./config/validateEnv');
validateEnv();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ── Route imports ──────────────────────────────────────
const authRoutes         = require('./routes/auth');
const reclamationRoutes  = require('./routes/reclamations');
const serviceRoutes      = require('./routes/services');
const userRoutes         = require('./routes/users');
const agentRoutes        = require('./routes/agents');
const notificationRoutes = require('./routes/notifications');
const aiRoutes            = require('./routes/ai');
const profileRoutes       = require('./routes/profile');
const messageRoutes       = require('./routes/messages');

// ── Connect to MongoDB ─────────────────────────────────
connectDB();

const app = express();

// ── Security headers ────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP logging (dev only) ─────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Global rate limiter ─────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes. Réessayez dans 15 minutes.' },
}));

// ── Auth rate limiter (stricter for login/register) ─────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

// ── Static uploads ──────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'BlediGo API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/reclamations',  reclamationRoutes);
app.use('/api/services',      serviceRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/agents',        agentRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/profile',       profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages',      messageRoutes);

// ── 404 handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable.' });
});

// ── Global error handler ────────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3001;

const server = app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────┐
  │  🏛  BlediGo API                         │
  │  ► http://localhost:${PORT}                 │
  │  ► ENV: ${process.env.NODE_ENV || 'development'}                  │
  └─────────────────────────────────────────┘
  `);
});

// ── Graceful shutdown ───────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Unhandled promise rejections ────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err.message);
  server.close(() => process.exit(1));
});

module.exports = app; // for testing

// trigger nodemon restart
