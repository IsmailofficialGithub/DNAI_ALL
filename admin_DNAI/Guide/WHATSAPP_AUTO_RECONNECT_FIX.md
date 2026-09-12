# WhatsApp Connection Fix - Auto-Reconnect After QR Scan

## Problem
After scanning the QR code, WhatsApp sends a "restart required" signal (status code 515). The current implementation doesn't handle this properly, so the connection closes and doesn't reconnect automatically with the saved session.

## Solution
Add automatic reconnection logic that:
1. Detects when status code is 515 (restartRequired)
2. Waits 2 seconds
3. Fetches the saved session data from database
4. Creates a new socket with the saved credentials
5. Completes the connection

## Implementation

Add this code in the `setupSocketEvents` function, in the `if (connection === 'close')` block:

```javascript
if (connection === 'close') {
  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
  const isRestart = statusCode === DisconnectReason.restartRequired; // 515
  
  console.log(`🔌 Connection closed, status: ${statusCode}, restart: ${isRestart}`);
  
  // Clean up socket
  activeSockets.delete(applicationId);
  
  // Update database
  await supabaseAdmin
    .from('whatsapp_applications')
    .update({
      status: shouldReconnect ? 'disconnected' : 'error',
      last_disconnected_at: new Date().toISOString(),
      qr_code: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', applicationId);

  // AUTO-RECONNECT LOGIC - THIS IS THE FIX
  if (isRestart) {
    console.log(`🔄 Auto-reconnecting after QR scan...`);
    setTimeout(async () => {
      try {
        const { data: app } = await supabaseAdmin
          .from('whatsapp_applications')
          .select('session_data')
          .eq('id', applicationId)
          .single();
        
        if (app?.session_data) {
          console.log(`♻️ Reconnecting with saved session`);
          await this.createSocket(applicationId, app.session_data);
        }
      } catch (error) {
        console.error(`❌ Auto-reconnect failed:`, error);
      }
    }, 2000);
  }
}
```

## Manual Fix Instructions

Since the automated replacement is having issues with special characters, here's how to manually add the fix:

1. Open `backend/services/whatsappService.js`
2. Find line 203-225 (the `if (connection === 'close')` block)
3. Replace the `if (shouldReconnect)` section (lines 223-225) with the auto-reconnect logic above
4. Save the file
5. The server will auto-restart with nodemon

## Expected Behavior After Fix

1. User clicks "Connect"
2. QR code appears
3. User scans QR code
4. Connection closes with status 515 (restart required)
5. **AUTO-RECONNECT happens** (2 second delay)
6. Connection opens successfully
7. Status changes to "connected"
8. User can send messages!

## Testing

After applying the fix:
1. Create a new WhatsApp application
2. Click "Connect"
3. Scan the QR code
4. Watch the server logs - you should see:
   ```
   🔌 Connection closed, status: 515, restart: true
   🔄 Auto-reconnecting after QR scan...
   ♻️ Reconnecting with saved session
   ✅ Connection opened for application
   ```
5. The status should change to "connected" automatically!
