# Support Widget - Quick Start Guide

## 🚀 2-Minute Setup

### Step 1: Add Script Tag
Add this before `</body>` tag:

```html
<script src="https://yourdomain.com/support-widget.js"></script>
<script>
  SupportWidget.init({
    apiUrl: 'https://your-api-domain.com/api/public/customer-support',
    apiKey: 'YOUR_API_KEY_HERE',
    buttonText: 'Contact Support',
    position: 'bottom-right'
  });
</script>
```

### Step 2: Done! ✅
The widget will appear automatically.

---

## 📋 What You Need

1. **Widget File URL**: `https://yourdomain.com/support-widget.js`
2. **API URL**: `https://your-api-domain.com/api/public/customer-support`
3. **API Key**: `sk_live_abc123xyz` (provided by admin)

---

## 🎯 Framework-Specific Examples

### React / Next.js
```jsx
// In _app.js or layout.js
<Script src="https://yourdomain.com/support-widget.js" />
<Script id="init-widget">
  {`SupportWidget.init({
    apiUrl: '${process.env.NEXT_PUBLIC_SUPPORT_API_URL}',
    apiKey: '${process.env.NEXT_PUBLIC_SUPPORT_API_KEY}'
  });`}
</Script>
```

### PHP / WordPress
```php
<script src="https://yourdomain.com/support-widget.js"></script>
<script>
  SupportWidget.init({
    apiUrl: '<?php echo get_option('support_api_url'); ?>',
    apiKey: '<?php echo get_option('support_api_key'); ?>'
  });
</script>
```

### Python / Django
```html
<script src="https://yourdomain.com/support-widget.js"></script>
<script>
  SupportWidget.init({
    apiUrl: '{{ support_api_url }}',
    apiKey: '{{ support_api_key }}'
  });
</script>
```

### Vue / Nuxt
```javascript
// In nuxt.config.js
head: {
  script: [{ src: 'https://yourdomain.com/support-widget.js' }]
}

// In plugin
if (window.SupportWidget) {
  window.SupportWidget.init({
    apiUrl: process.env.SUPPORT_API_URL,
    apiKey: process.env.SUPPORT_API_KEY
  });
}
```

---

## ⚙️ Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `apiUrl` | ✅ Yes | - | Your API endpoint URL |
| `apiKey` | ❌ No | - | Your unique API key |
| `buttonText` | ❌ No | "Contact Support" | Button label |
| `position` | ❌ No | "bottom-right" | Button position |

**Positions:** `bottom-right`, `bottom-left`, `top-right`, `top-left`

---

## 🔧 Direct API Usage (Without Widget)

### JavaScript
```javascript
const formData = new FormData();
formData.append('email', 'user@example.com');
formData.append('subject', 'Need Help');
formData.append('message', 'Description...');
formData.append('api_key', 'YOUR_API_KEY');

fetch('https://your-api-domain.com/api/public/customer-support/tickets', {
  method: 'POST',
  body: formData
});
```

### PHP
```php
$data = [
    'email' => 'user@example.com',
    'subject' => 'Need Help',
    'message' => 'Description...',
    'api_key' => 'YOUR_API_KEY'
];

$ch = curl_init('https://your-api-domain.com/api/public/customer-support/tickets');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
```

### Python
```python
import requests

data = {
    'email': 'user@example.com',
    'subject': 'Need Help',
    'message': 'Description...',
    'api_key': 'YOUR_API_KEY'
}

requests.post('https://your-api-domain.com/api/public/customer-support/tickets', json=data)
```

---

## 📡 API Endpoints

### Create Ticket
```
POST /api/public/customer-support/tickets
Content-Type: multipart/form-data

Fields:
- email (required)
- subject (required)
- message (required)
- name (optional)
- category (optional)
- priority (optional)
- files[] (optional, max 5)
- api_key (optional)
```

### View Tickets
```
GET /api/public/customer-support/tickets?email=user@example.com
GET /api/public/customer-support/tickets?email=user@example.com&ticket_number=TICKET-123
```

---

## ✅ Testing

1. Open your website
2. Look for the support button (bottom-right by default)
3. Click it and submit a test ticket
4. Check for success message with ticket number

---

## 🐛 Common Issues

**Widget not showing?**
- Check browser console
- Verify script URL is accessible
- Ensure script loads before init()

**API errors?**
- Verify API URL is correct
- Check CORS is enabled
- Verify API key format

---

## 📞 Need Help?

Contact support with:
- Error messages
- Browser console logs
- Your implementation code

---

**That's it!** The widget is ready to use. 🎉

