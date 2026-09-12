import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  initAuthCreds,
  BufferJSON
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { supabaseAdmin } from '../config/database.js';

// Store active socket connections
const activeSockets = new Map();

/**
 * WhatsApp Service for managing Baileys connections
 * Stores session data in database instead of file system
 */
class WhatsAppService {
  /**
   * Get or create socket connection for a WhatsApp application
   * @param {string} applicationId - WhatsApp application ID
   * @returns {Promise<WASocket>} Baileys socket instance
   */
  async getSocket(applicationId) {
    // Return existing socket if available and connected
    if (activeSockets.has(applicationId)) {
      const socket = activeSockets.get(applicationId);
      if (socket && socket.user) {
        return socket;
      }
      // Clean up disconnected socket
      activeSockets.delete(applicationId);
    }

    // Load session from database
    const { data: app, error } = await supabaseAdmin
      .from('whatsapp_applications')
      .select('id, phone, session_data, status')
      .eq('id', applicationId)
      .single();

    if (error || !app) {
      throw new Error(`WhatsApp application not found: ${applicationId}`);
    }

    // Create socket with database-backed auth state
    const socket = await this.createSocket(applicationId, app.session_data);

    // Store socket
    activeSockets.set(applicationId, socket);

    return socket;
  }

  /**
   * Create Baileys socket with database-backed session
   * @param {string} applicationId - Application ID
   * @param {string|null} sessionData - Stored session data (JSON string)
   * @returns {Promise<WASocket>} Socket instance
   */
  async createSocket(applicationId, sessionData = null) {
    const { version } = await fetchLatestBaileysVersion();

    // Create auth state from database session data
    const authState = await this.getAuthState(applicationId, sessionData);

    // Create a proper Pino-compatible logger (Baileys requirement)
    const logger = {
      level: 'silent',
      child: () => logger,
      trace: () => { },
      debug: () => { },
      info: () => { },
      warn: () => { },
      error: () => { },
      fatal: () => { }
    };

    const socket = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: authState,
      browser: ['Admin Panel', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      getMessage: async (key) => {
        return {
          conversation: 'Message from Admin Panel'
        };
      }
    });

    // Store socket in active sockets BEFORE setting up events
    activeSockets.set(applicationId, socket);

    // Handle connection events
    this.setupSocketEvents(socket, applicationId);

    return socket;
  }

  /**
   * Get auth state from database or create new
   * @param {string} applicationId - Application ID
   * @param {string|null} sessionData - Stored session data
   * @returns {Promise<Object>} Auth state object
   */
  async getAuthState(applicationId, sessionData) {
    let creds;

    // If we have session data, restore it
    if (sessionData) {
      try {
        creds = JSON.parse(sessionData, BufferJSON.reviver);
        console.log('✅ Restored session data for application:', applicationId);
      } catch (error) {
        console.error('❌ Error parsing session data:', error);
        creds = initAuthCreds();
      }
    } else {
      // Create new auth credentials
      creds = initAuthCreds();
      console.log('🆕 Created new auth credentials for application:', applicationId);
    }

    // Return auth state object that Baileys expects (no extra 'state' wrapper)
    return {
      creds,
      keys: {
        get: async (type, ids) => {
          // Return empty object for now - keys are stored in creds
          return {};
        },
        set: async (data) => {
          // Keys are handled in creds.update
        }
      },
      saveCreds: async () => {
        await this.saveSessionData(applicationId, creds);
      }
    };
  }

  /**
   * Save session data to database
   * @param {string} applicationId - Application ID
   * @param {Object} creds - Baileys credentials
   */
  async saveSessionData(applicationId, creds) {
    try {
      const sessionJson = JSON.stringify(creds, BufferJSON.replacer);
      console.log('💾 Saving session data for application:', applicationId);
      await supabaseAdmin
        .from('whatsapp_applications')
        .update({
          session_data: sessionJson,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);
    } catch (error) {
      console.error('❌ Error saving session data:', error);
    }
  }

  /**
   * Setup socket event handlers
   * @param {WASocket} socket - Baileys socket
   * @param {string} applicationId - Application ID
   */
  setupSocketEvents(socket, applicationId) {
    // Credentials update handler - save to database
    socket.ev.on('creds.update', async () => {
      const authState = socket.authState;
      if (authState?.creds) {
        await this.saveSessionData(applicationId, authState.creds);
      }
    });

    // Connection update handler
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Generate QR code data URL
        console.log('📱 QR code generated for application:', applicationId);
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          await supabaseAdmin
            .from('whatsapp_applications')
            .update({
              qr_code: qrDataUrl,
              status: 'connecting',
              updated_at: new Date().toISOString()
            })
            .eq('id', applicationId);
        } catch (error) {
          console.error('❌ Error generating QR code:', error);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`🔌 Connection closed for application ${applicationId}, status code: ${statusCode}`);

        // Update status in database
        await supabaseAdmin
          .from('whatsapp_applications')
          .update({
            status: shouldReconnect ? 'disconnected' : 'error',
            last_disconnected_at: new Date().toISOString(),
            qr_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationId);

        // Clean up socket
        activeSockets.delete(applicationId);

        if (shouldReconnect) {
          const isRestart = statusCode === DisconnectReason.restartRequired;
          if (isRestart) {
            console.log(`🔄 Auto-reconnecting application ${applicationId} after restart...`);
            setTimeout(async () => {
              try {
                const { data: app } = await supabaseAdmin
                  .from('whatsapp_applications')
                  .select('session_data')
                  .eq('id', applicationId)
                  .single();

                if (app?.session_data) {
                  console.log(`♻️ Reconnecting with saved session for ${applicationId}`);
                  await this.createSocket(applicationId, app.session_data);
                }
              } catch (error) {
                console.error(`❌ Error auto-reconnecting ${applicationId}:`, error);
              }
            }, 2000);
          } else {
            console.log(`⚠️ Connection lost for ${applicationId}, manual reconnection required`);
          }
        }
      } else if (connection === 'open') {
        console.log(`✅ Connection opened for application ${applicationId}`);

        // Connected successfully - credentials are already saved via creds.update
        await supabaseAdmin
          .from('whatsapp_applications')
          .update({
            status: 'connected',
            qr_code: null,
            last_connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationId);
      } else if (connection === 'connecting') {
        console.log(`🔄 Connecting application ${applicationId}...`);
        await supabaseAdmin
          .from('whatsapp_applications')
          .update({
            status: 'connecting',
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationId);
      }
    });

  }

  /**
   * Send WhatsApp message
   * @param {string} applicationId - Application ID
   * @param {string} phoneNumber - Recipient phone number (with country code, no +)
   * @param {string} message - Message text
   * @returns {Promise<Object>} Message send result
   */
  async sendMessage(applicationId, phoneNumber, message) {
    try {
      // Check application status in database first
      const { data: app, error: dbError } = await supabaseAdmin
        .from('whatsapp_applications')
        .select('status')
        .eq('id', applicationId)
        .single();

      if (dbError || !app) {
        throw new Error('WhatsApp application not found');
      }

      // If connecting, wait a bit for connection to complete
      if (app.status === 'connecting') {
        console.log(`⏳ Application is connecting, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check again
        const { data: updatedApp } = await supabaseAdmin
          .from('whatsapp_applications')
          .select('status')
          .eq('id', applicationId)
          .single();

        if (updatedApp?.status !== 'connected') {
          throw new Error('Application is still connecting. Please wait and try again.');
        }
      }

      // If not connected, throw error
      if (app.status !== 'connected') {
        throw new Error(`Application is ${app.status}. Please connect it first.`);
      }

      const socket = await this.getSocket(applicationId);

      if (!socket || !socket.user) {
        throw new Error('WhatsApp application is not connected. Please reconnect.');
      }

      // Format phone number (remove + and spaces)
      const formattedNumber = phoneNumber.replace(/[+\s]/g, '');

      // Ensure it ends with @s.whatsapp.net
      const jid = formattedNumber.includes('@')
        ? formattedNumber
        : `${formattedNumber}@s.whatsapp.net`;

      // Send message
      const result = await socket.sendMessage(jid, {
        text: message
      });

      return {
        success: true,
        messageId: result.key.id,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error sending WhatsApp message:', error);

      // If connection closed error, remove socket from memory so it gets recreated
      if (error.message && error.message.includes('Connection Closed')) {
        console.log(`🗑️ Removing stale socket for ${applicationId}`);
        activeSockets.delete(applicationId);
      }

      throw error;
    }
  }

  /**
   * Disconnect socket for an application
   * @param {string} applicationId - Application ID
   */
  async disconnect(applicationId) {
    const socket = activeSockets.get(applicationId);
    if (socket) {
      await socket.logout();
      activeSockets.delete(applicationId);
    }

    // Clear session data and update status
    await supabaseAdmin
      .from('whatsapp_applications')
      .update({
        status: 'disconnected',
        session_data: null,
        qr_code: null,
        last_disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);
  }

  /**
   * Reconnect application (clear session and generate new QR)
   * @param {string} applicationId - Application ID
   */
  async reconnect(applicationId) {
    // Disconnect existing connection
    await this.disconnect(applicationId);

    // Clear session data
    await supabaseAdmin
      .from('whatsapp_applications')
      .update({
        session_data: null,
        status: 'disconnected',
        qr_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);

    // Create new socket (will generate new QR)
    const socket = await this.createSocket(applicationId, null);
    activeSockets.set(applicationId, socket);
  }

  /**
   * Get QR code for application
   * @param {string} applicationId - Application ID
   * @returns {Promise<string|null>} QR code data URL or null
   */
  async getQRCode(applicationId) {
    const { data: app } = await supabaseAdmin
      .from('whatsapp_applications')
      .select('qr_code, status')
      .eq('id', applicationId)
      .single();

    return app?.qr_code || null;
  }

  /**
   * Get connection status
   * @param {string} applicationId - Application ID
   * @returns {Promise<string>} Connection status
   */
  async getStatus(applicationId) {
    const { data: app } = await supabaseAdmin
      .from('whatsapp_applications')
      .select('status')
      .eq('id', applicationId)
      .single();

    return app?.status || 'disconnected';
  }
}

// Export singleton instance
export default new WhatsAppService();
