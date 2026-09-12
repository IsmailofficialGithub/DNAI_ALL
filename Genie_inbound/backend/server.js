import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { sanitizeError } from './utils/errorHandler.js';

// Route imports
import aiRoutes from './routes/aiRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import callRoutes from './routes/callRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

// Initialize background queue workers
import './services/queueService.js';

// Load environment variables
dotenv.config();

const app = express();
app.set('trust proxy', 1); // Fixes express-rate-limit ERR_ERL_UNEXPECTED_X_FORWARDED_FOR error
const PORT = process.env.PORT || 3001;

// General API limiter: 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, error: 'Too many requests, please try again later.' }
});

// Basic Middlewares
// Configure CORS (SEC-06)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];
// Basic Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy (SEC-06 Violation)'));
    }
  },
  credentials: true
}));

// JSON Parser with Raw Body support for Stripe Webhooks
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.includes('/webhook')) {
      req.rawBody = buf;
    }
  }
}));

app.use('/api/', apiLimiter);

// Register Routes
app.use('/api/shared', paymentRoutes);
app.use('/', emailRoutes); // Handles /email legacy route
app.use('/api', aiRoutes);
app.use('/api', emailRoutes); // Merged under /api prefix for new routes
app.use('/api', documentRoutes);
app.use('/api', callRoutes);
app.use('/api', leadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  const { statusCode, message } = sanitizeError(err);
  console.error(`[GlobalError] [${req.method}] ${req.path}:`, err);
  res.status(statusCode).json({ success: false, error: message });
});

// Start server
app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`🚀 GENIE BACKEND RUNNING ON PORT ${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log('==============================================');
});
