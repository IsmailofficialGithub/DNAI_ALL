# Quick Test Guide - WhatsApp Integration

## Prerequisites
✅ Server is running: `cd backend && npm run dev:all`
✅ Database migration has been run (039_create_whatsapp_applications_table.sql)
✅ You have admin access to the application

## Quick Test Steps

### 1. Access the WhatsApp Settings
1. Open your browser and navigate to the admin panel
2. Go to **Admin Settings** (usually at `/admin/settings`)
3. Click on the **WhatsApp** tab

### 2. Create a Test Application
1. Click **"Add WhatsApp Application"** button
2. Fill in the form:
   ```
   Name: Test Application
   Phone: +1234567890 (use your actual WhatsApp number)
   Purpose: Testing WhatsApp integration
   ```
3. Click **Save**

### 3. Connect to WhatsApp
1. Find your application in the list
2. Click the green **"Connect"** button (Wifi icon)
3. A modal will appear with a QR code
4. On your phone:
   - Open WhatsApp
   - Go to **Settings** → **Linked Devices**
   - Tap **"Link a Device"**
   - Scan the QR code from the modal
5. Watch the status change:
   - **Connecting** (yellow) → **Connected** (green)

### 4. Verify Connection
Check the server logs for these messages:
```
🆕 Created new auth credentials for application: [uuid]
📱 QR code generated for application: [uuid]
🔄 Connecting application [uuid]...
✅ Connection opened for application [uuid]
💾 Saving session data for application: [uuid]
```

### 5. Test Message Sending (Optional)
Use the API to send a test message:

```bash
# Using curl
curl -X POST http://localhost:5000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "applicationId": "YOUR_APPLICATION_ID",
    "phoneNumber": "1234567890",
    "message": "Hello from Admin Panel!"
  }'
```

Or using JavaScript:
```javascript
const response = await fetch('http://localhost:5000/api/whatsapp/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    applicationId: 'YOUR_APPLICATION_ID',
    phoneNumber: '1234567890',
    message: 'Hello from Admin Panel!'
  })
});

const result = await response.json();
console.log(result);
```

## Expected Behavior

### ✅ Success Indicators
- QR code appears within 2-3 seconds of clicking "Connect"
- After scanning, status changes to "Connected" within 5 seconds
- Server logs show successful connection messages
- Application can send messages without errors

### ❌ Common Issues

#### QR Code doesn't appear
**Check:**
- Server is running (`npm run dev:all` in backend folder)
- No errors in server console
- Database table exists

**Fix:**
- Restart the server
- Check database connection
- Run the migration file

#### Connection fails after scanning
**Check:**
- Phone number is not already linked to 4 devices (WhatsApp limit)
- Using latest WhatsApp version
- Internet connection is stable

**Fix:**
- Unlink an old device from WhatsApp
- Update WhatsApp app
- Try again with better internet connection

#### Status stuck on "Connecting"
**Check:**
- Server logs for errors
- QR code was scanned correctly
- WhatsApp app is responding

**Fix:**
- Click "Reconnect" to generate a new QR code
- Check server logs for specific errors
- Restart the server if needed

## Server Logs to Monitor

While testing, watch for these log messages:

### Good Signs ✅
```
🆕 Created new auth credentials for application: [id]
📱 QR code generated for application: [id]
🔄 Connecting application [id]...
✅ Connection opened for application [id]
💾 Saving session data for application: [id]
```

### Warning Signs ⚠️
```
❌ Error parsing session data: [error]
❌ Error generating QR code: [error]
❌ Error saving session data: [error]
🔌 Connection closed for application [id], status code: [code]
```

## Testing Checklist

- [ ] Server is running without errors
- [ ] Can access WhatsApp tab in Admin Settings
- [ ] Can create a new WhatsApp application
- [ ] QR code appears when clicking "Connect"
- [ ] Can scan QR code with WhatsApp mobile app
- [ ] Status changes to "Connected" after scanning
- [ ] Server logs show successful connection
- [ ] Can send a test message (optional)
- [ ] Connection persists after page refresh
- [ ] Session data is saved in database

## Next Steps After Successful Test

1. **Create production applications**: Set up WhatsApp applications for your actual use cases
2. **Integrate with your workflows**: Use the API to send messages from your application
3. **Monitor connections**: Regularly check the status of your applications
4. **Handle disconnections**: Set up alerts or auto-reconnection logic if needed

## Support

If you encounter issues:
1. Check the server logs first
2. Review the `WHATSAPP_FIX_SUMMARY.md` for detailed troubleshooting
3. Verify all prerequisites are met
4. Try disconnecting and reconnecting
5. Restart the server as a last resort

## Important Notes

- **Session Persistence**: Once connected, you don't need to scan QR code again unless you disconnect
- **Multiple Devices**: WhatsApp allows up to 4 linked devices per account
- **Rate Limits**: Be mindful of WhatsApp's rate limits when sending messages
- **Phone Number**: The phone number must have an active WhatsApp account
- **Security**: Only admin users can manage WhatsApp applications

---

**Last Updated**: 2026-01-24
**Status**: ✅ Working - Fix Applied
