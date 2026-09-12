
# WhatsApp Integration - Technical Architecture

## Overview
This document describes the technical architecture of the WhatsApp integration using Baileys library with database-backed session storage.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  AdminSettings.js (WhatsApp Tab)                           │ │
│  │  - Create/Edit/Delete Applications                         │ │
│  │  - Connect/Disconnect/Reconnect                            │ │
│  │  - Display QR Code Modal                                   │ │
│  │  - Poll for connection status                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Node.js/Express)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  whatsapp.routes.js                                        │ │
│  │  - POST /api/whatsapp/applications                         │ │
│  │  - GET  /api/whatsapp/applications                         │ │
│  │  - POST /api/whatsapp/applications/:id/connect             │ │
│  │  - POST /api/whatsapp/applications/:id/disconnect          │ │
│  │  - GET  /api/whatsapp/applications/:id/qr                  │ │
│  │  - POST /api/whatsapp/send                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  whatsapp.controller.js                                    │ │
│  │  - Handle HTTP requests                                    │ │
│  │  - Validate input                                          │ │
│  │  - Call WhatsAppService                                    │ │
│  │  - Return responses                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  whatsappService.js (Core Service)                         │ │
│  │  - Manage Baileys socket connections                       │ │
│  │  - Handle auth state (database-backed)                     │ │
│  │  - Generate/store QR codes                                 │ │
│  │  - Send messages                                           │ │
│  │  - Event handling (connection, creds)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Baileys Protocol
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WhatsApp Web API                            │
│  - QR Code Authentication                                        │
│  - Message Sending/Receiving                                     │
│  - Connection Management                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Database Storage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  whatsapp_applications table                               │ │
│  │  - id (uuid)                                               │ │
│  │  - name, phone, purpose                                    │ │
│  │  - session_data (encrypted JSON)                           │ │
│  │  - status, qr_code                                         │ │
│  │  - timestamps, created_by                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend Layer

#### AdminSettings.js
**Responsibilities:**
- Render WhatsApp management UI
- Handle user interactions (create, edit, delete, connect)
- Display QR code modal
- Poll for connection status updates
- Show real-time connection status

**Key Functions:**
```javascript
loadWhatsAppApplications()     // Fetch all applications
handleConnectWhatsApp(id)      // Initiate connection
startQRPolling(id)             // Poll for QR code and status
handleSaveWhatsApp()           // Create/update application
handleDeleteWhatsApp(id)       // Delete application
```

**State Management:**
- `whatsappApplications`: List of all applications
- `showQRModal`: QR code modal visibility
- `qrCodeData`: Current QR code data URL
- `qrPollingInterval`: Polling interval reference

### 2. Backend Layer

#### whatsapp.routes.js
**Endpoints:**
```javascript
POST   /api/whatsapp/applications           // Create new application
GET    /api/whatsapp/applications           // List all applications
GET    /api/whatsapp/applications/:id       // Get single application
PUT    /api/whatsapp/applications/:id       // Update application
DELETE /api/whatsapp/applications/:id       // Delete application
POST   /api/whatsapp/applications/:id/connect      // Initiate connection
POST   /api/whatsapp/applications/:id/disconnect   // Disconnect
POST   /api/whatsapp/applications/:id/reconnect    // Reconnect
GET    /api/whatsapp/applications/:id/qr           // Get QR code
POST   /api/whatsapp/send                   // Send message
```

#### whatsapp.controller.js
**Responsibilities:**
- Validate request parameters
- Handle authentication/authorization
- Call WhatsAppService methods
- Format and return responses
- Log activities

**Key Functions:**
```javascript
createWhatsAppApplication()    // Create new app
getWhatsAppApplications()      // List apps
connectWhatsAppApplication()   // Start connection
disconnectWhatsAppApplication() // Stop connection
getQRCode()                    // Fetch QR code
```

#### whatsappService.js (Core Service)
**Responsibilities:**
- Manage Baileys socket connections
- Handle authentication state
- Store/retrieve session data from database
- Generate QR codes
- Send WhatsApp messages
- Handle connection events

**Key Components:**

##### Socket Management
```javascript
activeSockets = new Map()  // Store active connections
getSocket(applicationId)   // Get or create socket
createSocket(applicationId, sessionData)  // Create new socket
```

##### Auth State Management
```javascript
getAuthState(applicationId, sessionData) {
  // Initialize or restore credentials
  let creds = sessionData 
    ? JSON.parse(sessionData, BufferJSON.reviver)
    : initAuthCreds();
  
  // Return Baileys-compatible auth state
  return {
    state: {
      creds,
      keys: { get, set }
    },
    saveCreds: async () => saveSessionData()
  };
}
```

##### Event Handlers
```javascript
// Save credentials when they update
socket.ev.on('creds.update', async () => {
  await saveSessionData(applicationId, creds);
});

// Handle connection state changes
socket.ev.on('connection.update', async (update) => {
  // Handle: qr, connecting, open, close
});
```

##### Message Sending
```javascript
async sendMessage(applicationId, phoneNumber, message) {
  const socket = await getSocket(applicationId);
  const jid = `${phoneNumber}@s.whatsapp.net`;
  return await socket.sendMessage(jid, { text: message });
}
```

### 3. Database Layer

#### whatsapp_applications Table Schema
```sql
CREATE TABLE whatsapp_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  phone varchar(50) NOT NULL,
  purpose text,
  session_data text,              -- Encrypted Baileys credentials
  status varchar(20) DEFAULT 'disconnected',
  qr_code text,                   -- Temporary QR code data URL
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_by uuid REFERENCES auth.users(id)
);
```

**Indexes:**
- `idx_whatsapp_applications_status` - Fast status filtering
- `idx_whatsapp_applications_phone` - Phone number lookups
- `idx_whatsapp_applications_created_by` - User filtering
- `idx_whatsapp_applications_created_at` - Chronological sorting

## Data Flow

### Connection Flow
```
1. User clicks "Connect" in UI
   ↓
2. Frontend calls POST /api/whatsapp/applications/:id/connect
   ↓
3. Controller validates request
   ↓
4. Service creates Baileys socket with auth state
   ↓
5. Baileys generates QR code
   ↓
6. Service saves QR code to database
   ↓
7. Frontend polls GET /api/whatsapp/applications/:id/qr
   ↓
8. QR code displayed to user
   ↓
9. User scans QR with WhatsApp mobile app
   ↓
10. Baileys receives authentication
    ↓
11. creds.update event fires
    ↓
12. Service saves credentials to database
    ↓
13. connection.update event fires (status: 'open')
    ↓
14. Service updates status to 'connected'
    ↓
15. Frontend detects 'connected' status
    ↓
16. QR modal closes, success message shown
```

### Message Sending Flow
```
1. Application calls POST /api/whatsapp/send
   ↓
2. Controller validates request
   ↓
3. Service gets socket for applicationId
   ↓
4. If socket exists and connected, use it
   ↓
5. If not, load session from database
   ↓
6. Create socket with restored credentials
   ↓
7. Format phone number to JID
   ↓
8. Send message via Baileys
   ↓
9. Return message ID and timestamp
```

## Security Considerations

### Authentication & Authorization
- All endpoints require authentication
- Only admin users can manage WhatsApp applications
- User ID is stored with created applications

### Data Protection
- Session data is stored as encrypted JSON
- Credentials never exposed in API responses
- QR codes are temporary and cleared after connection
- Database uses row-level security (RLS)

### Rate Limiting
- Should implement rate limiting on message sending
- Monitor for abuse patterns
- WhatsApp has its own rate limits

## Performance Optimization

### Socket Connection Pooling
- Active sockets stored in memory (Map)
- Reuse existing connections when possible
- Clean up disconnected sockets

### Database Queries
- Indexed columns for fast lookups
- Only fetch necessary columns
- Use single() for individual records

### QR Code Polling
- Poll every 2 seconds (configurable)
- Stop polling after 5 minutes
- Stop polling when connected

## Error Handling

### Connection Errors
```javascript
DisconnectReason.loggedOut      // User logged out, don't reconnect
DisconnectReason.connectionClosed // Network issue, can reconnect
DisconnectReason.timedOut       // Timeout, can reconnect
```

### Database Errors
- Graceful degradation
- Log errors without crashing
- Return user-friendly messages

### Baileys Errors
- Catch and log all Baileys errors
- Update status to 'error' in database
- Allow user to retry

## Monitoring & Logging

### Log Levels
```javascript
console.log('✅ Success message')
console.log('🆕 New resource created')
console.log('📱 QR code related')
console.log('🔄 Connection state change')
console.log('💾 Database operation')
console.error('❌ Error occurred')
```

### Metrics to Track
- Number of active connections
- Message send success/failure rate
- Connection uptime
- QR code scan time
- Session persistence rate

## Scalability Considerations

### Current Limitations
- Sockets stored in memory (single server)
- No load balancing support
- Session data in single database

### Future Improvements
1. **Redis for Socket Storage**: Store socket references in Redis for multi-server support
2. **Message Queue**: Use queue for message sending (Bull, RabbitMQ)
3. **Webhook Support**: Receive incoming messages via webhooks
4. **Auto-reconnection**: Implement automatic reconnection logic
5. **Health Checks**: Regular connection health monitoring

## Dependencies

### Core Libraries
```json
{
  "@whiskeysockets/baileys": "^6.x",  // WhatsApp Web API
  "qrcode": "^1.x",                   // QR code generation
  "@supabase/supabase-js": "^2.x"     // Database client
}
```

### Baileys Exports Used
- `makeWASocket`: Create WhatsApp socket
- `DisconnectReason`: Connection status codes
- `fetchLatestBaileysVersion`: Get latest WA version
- `initAuthCreds`: Initialize credentials
- `BufferJSON`: Serialize/deserialize Buffers

## Testing Strategy

### Unit Tests
- Test auth state creation
- Test credential serialization
- Test message formatting

### Integration Tests
- Test full connection flow
- Test message sending
- Test reconnection logic

### Manual Testing
- Create application
- Connect via QR code
- Send test message
- Disconnect and reconnect
- Delete application

## Maintenance

### Regular Tasks
- Monitor connection health
- Clean up old QR codes
- Archive disconnected applications
- Update Baileys library
- Review security logs

### Troubleshooting Checklist
1. Check server logs
2. Verify database connection
3. Check Baileys version compatibility
4. Verify WhatsApp account status
5. Check network connectivity

---

**Version**: 1.0.0
**Last Updated**: 2026-01-24
**Status**: Production Ready
