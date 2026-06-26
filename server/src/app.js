import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import config from './config/env.js';
import { loadSeedData } from './services/ticketService.js';
import { startScheduler } from './scheduler/slaScheduler.js';

import reportRoutes       from './routes/reportRoutes.js';
import ticketRoutes       from './routes/ticketRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import dashboardRoutes    from './routes/dashboardRoutes.js';
import userRoutes         from './routes/userRoutes.js';
import sseRoutes          from './routes/sseRoutes.js';

const app = express();

loadSeedData().then((result) => {
  if (result) {
    console.log('[Boot] Seed data loaded');
  } else {
    console.log('[Boot] Seed data unavailable; continuing with runtime state');
  }
  startScheduler();
}).catch(err => console.warn('[Boot] Seed load skipped:', err.message));


// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** CORS — allow the configured frontend origin */
app.use(cors({ origin: config.clientUrl, credentials: true }));

/** Parse JSON bodies (limit raised to 100 MB for media uploads) */
app.use(express.json({ limit: '100mb' }));

/** Parse URL-encoded bodies */
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

/** Serve static uploads */
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

/**
 * Simple request logger.
 * Logs method, URL, and ISO timestamp to stdout.
 */
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/health
 * @desc    Lightweight liveness probe
 * @returns {{ status: string, timestamp: string }}
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.use('/api/reports',  reportRoutes);
app.use('/api/tickets',  ticketRoutes);
app.use('/api/verify',   verificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/events',   sseRoutes);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------------------------------------------------------------------------
// Central error handler
// ---------------------------------------------------------------------------

/**
 * Express error-handling middleware.
 * Catches thrown / next(err) errors and returns a consistent JSON envelope.
 *
 * @param {Error}                err
 * @param {express.Request}      _req
 * @param {express.Response}     res
 * @param {express.NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = config.nodeEnv === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  console.error(`[Error] ${status} — ${err.message}`);
  if (config.nodeEnv !== 'production') console.error(err.stack);

  res.status(status).json({ error: message });
});

export default app;
