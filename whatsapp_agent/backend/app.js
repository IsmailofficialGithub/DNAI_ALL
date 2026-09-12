require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (required when behind reverse proxy like Nginx or Railway)
app.set('trust proxy', 1);

// ============================================================================
// CORS CONFIGURATION
// ============================================================================
app.use(cors());

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging (development only)
if (process.env.NODE_ENV !== 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
  });
}

// Serve static frontend files if they exist
const path = require('path');
const publicPath = path.join(__dirname, 'public');
if (require('fs').existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log('✅ Static files served from:', publicPath);
}

// ============================================================================
// SUPABASE AUTHENTICATION & LOGIC PLACEHOLDERS
// ============================================================================

// Initialize Supabase client
const supabase = require('./src/lib/supabase');

// Mount Authentication Router
const authRouter = require('./src/routes/auth');
app.use('/api/auth', authRouter);

// TODO: Implement Supabase Authentication Middleware
// TODO: Implement API Routes utilizing Supabase

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// Catch-all route to serve the React frontend (SPA routing support)
const frontendIndexPath = path.join(__dirname, 'public', 'index.html');
if (require('fs').existsSync(frontendIndexPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }
    res.sendFile(frontendIndexPath);
  });
}

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

process.on('uncaughtException', (error) => {
  console.error('🔴 Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 Unhandled Rejection at:', promise);
});

// Import Baileys Service
let initializeExistingSessions = null;
try {
  const baileysService = require('./src/services/baileysService');
  initializeExistingSessions = baileysService.initializeExistingSessions;
} catch (error) {
  console.warn('⚠️ Could not load Baileys Service:', error.message);
}

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Minimalist Backend Server Started Successfully');
  console.log(`Server running on port ${PORT}`);
  console.log('='.repeat(60));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60) + '\n');

  if (initializeExistingSessions) {
    setTimeout(async () => {
      try {
        await initializeExistingSessions();
        console.log('✅ Baileys WhatsApp sessions initialized.');
      } catch (error) {
        console.error('Error initializing WhatsApp sessions:', error.message);
      }
    }, 1000);
  } else {
    console.warn('⚠️ Skipping Baileys initialization (service not found).');
  }
});

process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = app;
