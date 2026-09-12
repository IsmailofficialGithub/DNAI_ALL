# Public Support Ticket Widget - Implementation Guide

## 🎯 Overview

This guide explains how to implement the public support ticket system that allows users from multiple websites to submit tickets directly to your admin panel.

## 📋 Architecture

### **Recommended Approach: Public API + Embeddable Widget**

✅ **Best Solution** - Single API endpoint + JavaScript widget
- One API endpoint handles all external websites
- Simple integration (just add a script tag)
- Centralized management in admin panel
- Tracks source website/product
- Secure with rate limiting

---

## 🚀 Quick Start

### Step 1: Add Route to Server

The public support route is already added to `backend/server.js`:
```javascript
app.use('/api/public/customer-support', publicSupportRoutes);
```

### Step 2: Configure API Keys (Optional but Recommended)

Add API keys to your `.env` file to track which website submitted the ticket:

```env
# Format: API_KEY_WEBSITE_NAME=actual-key-value
PUBLIC_SUPPORT_API_KEYS=API_KEY_WEBSITE1=abc123xyz,API_KEY_WEBSITE2=def456uvw,API_KEY_WEBSITE3=ghi789rst
```

### Step 3: Deploy Widget File

Copy `front-end/public/support-widget.js` to your public assets folder (or CDN).

### Step 4: Add Widget to Your Websites

Add this code to any website where you want the support widget:

```html
<!-- Add before closing </body> tag -->
<script src="https://your-domain.com/support-widget.js"></script>
<script>
  SupportWidget.init({
    apiUrl: 'https://your-api-domain.com/api/public/customer-support',
    apiKey: 'abc123xyz', // Optional: Your API key for this website
    buttonText: 'Contact Support',
    position: 'bottom-right' // bottom-right, bottom-left, top-right, top-left
  });
</script>
```

---

## 📡 API Endpoint

### **POST** `/api/public/customer-support/tickets`

**No authentication required** - Public endpoint

#### Request Body:
```json
{
  "subject": "I need help with...",
  "message": "Detailed message here",
  "email": "user@example.com",
  "name": "John Doe",           // Optional
  "category": "technical",      // Optional: general, technical, billing, feature_request, bug_report
  "priority": "medium",         // Optional: low, medium, high, urgent
  "api_key": "abc123xyz",       // Optional: to identify source website
  "source_url": "https://...",  // Optional: URL where ticket was created
  "metadata": {}                // Optional: additional data
}
```

#### Response:
```json
{
  "success": true,
  "data": {
    "ticket_number": "TICKET-20241201-12345",
    "ticket_id": "uuid-here",
    "message": "Support ticket created successfully. We'll get back to you soon!"
  },
  "rate_limit": {
    "remaining": 4
  }
}
```

---

## 🔒 Security Features

### 1. **Rate Limiting**
- **5 tickets per hour per IP address**
- Prevents spam and abuse
- Returns 429 status if exceeded

### 2. **Input Validation**
- Email format validation
- String sanitization
- XSS protection
- SQL injection prevention

### 3. **API Key Validation** (Optional)
- Track which website submitted the ticket
- Can be used for additional security
- Stored in environment variables or database

---

## 🎨 Widget Customization

### Basic Configuration:
```javascript
SupportWidget.init({
  apiUrl: 'https://your-api.com/api/public/customer-support',
  apiKey: 'your-key',           // Optional
  buttonText: 'Contact Support',
  position: 'bottom-right'      // bottom-right, bottom-left, top-right, top-left
});
```

### Advanced Options:
The widget automatically includes:
- Source URL (where ticket was created)
- User agent (browser info)
- Referrer information
- Timestamp

---

## 📊 Admin Panel Integration

### Viewing Public Tickets

Public tickets appear in your admin panel with:
- **user_role**: `external`
- **user_id**: `null` (no authenticated user)
- **tags**: Website name (if API key provided)
- **internal_notes**: Source URL, user agent, metadata

### Filtering Public Tickets

In your admin panel, you can filter tickets by:
- Role = "external"
- Tags (website name)
- Category
- Status

---

## 🔧 Alternative Approaches

### Option 1: Simple Form (No Widget)

If you prefer a simple HTML form instead of the widget:

```html
<form id="support-form">
  <input type="email" name="email" required>
  <input type="text" name="subject" required>
  <textarea name="message" required></textarea>
  <button type="submit">Submit</button>
</form>

<script>
document.getElementById('support-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  const response = await fetch('https://your-api.com/api/public/customer-support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      api_key: 'your-api-key', // Optional
      source_url: window.location.href
    })
  });
  
  const result = await response.json();
  if (result.success) {
    alert('Ticket created! #' + result.data.ticket_number);
  }
});
</script>
```

### Option 2: Server-Side Integration

If you want to submit from your server (PHP, Python, etc.):

```php
<?php
$data = [
    'email' => $_POST['email'],
    'subject' => $_POST['subject'],
    'message' => $_POST['message'],
    'api_key' => 'your-api-key',
    'source_url' => 'https://yourwebsite.com'
];

$ch = curl_init('https://your-api.com/api/public/customer-support/tickets');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
$result = json_decode($response, true);

if ($result['success']) {
    echo "Ticket created: " . $result['data']['ticket_number'];
}
?>
```

---

## 📝 Database Schema

Public tickets are stored in the same `support_tickets` table:
- `user_id`: `NULL` (no authenticated user)
- `user_role`: `'external'`
- `user_email`: Provided email
- `user_name`: Provided name
- `tags`: Website name (if API key provided)
- `internal_notes`: Source URL, user agent, metadata

---

## 🛠️ Troubleshooting

### Widget Not Appearing?
1. Check browser console for errors
2. Verify `apiUrl` is correct
3. Ensure script is loaded before `init()` call

### API Returns 429 (Rate Limit)?
- Wait 1 hour or use different IP
- Consider implementing CAPTCHA for higher limits

### Tickets Not Showing in Admin Panel?
- Check `user_role = 'external'` filter
- Verify database connection
- Check admin panel filters

---

## 🎯 Best Practices

1. **Use API Keys**: Track which website submitted each ticket
2. **Monitor Rate Limits**: Adjust if needed for legitimate users
3. **Add CAPTCHA**: For high-traffic sites (optional enhancement)
4. **Email Notifications**: Set up email alerts for new tickets
5. **Response Time**: Set expectations for response time

---

## 🔄 Future Enhancements

Possible improvements:
- [ ] CAPTCHA integration (reCAPTCHA, hCaptcha)
- [ ] Email notifications to users
- [ ] Ticket status checking endpoint
- [ ] Multi-language support
- [ ] Customizable widget themes
- [ ] File attachment support

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review API response errors
3. Check server logs
4. Verify environment variables

---

**✅ You're all set!** Users from any website can now submit tickets directly to your admin panel.

