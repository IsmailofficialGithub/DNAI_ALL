# Support Widget Implementation Guide

## 📋 Overview

This guide explains how to integrate the Support Ticket Widget into your project, regardless of the technology stack (React, PHP, Python, Vue, Angular, etc.).

The widget is a **standalone JavaScript file** that can be added to any website with just a few lines of code.

---

## 🚀 Quick Start (Any Framework)

### Step 1: Host the Widget File

You need to host the `support-widget.js` file on a publicly accessible URL. Options:

1. **Your own server/CDN**: Upload to your public assets folder
2. **CDN**: Use services like Cloudflare, AWS CloudFront, etc.
3. **GitHub Pages**: Host it for free on GitHub Pages

**Example URLs:**
- `http://dev.duhanashrah.ai/support-widget.js`
- `https://cdn.yourdomain.com/support-widget.js`
- `https://yourusername.github.io/support-widget.js`

### Step 2: Get Your API Details

From the admin panel, you'll receive:
- **API URL**: `http://dev.duhanashrah.ai/api/api/public/customer-support`
- **API Key** (optional): `1234567890` (unique for your website)

### Step 3: Add to Your Website

Add these two lines before the closing `</body>` tag:

```html
<script src="http://dev.duhanashrah.ai/support-widget.js"></script>
<script>
  SupportWidget.init({
    apiUrl: 'http://dev.duhanashrah.ai/api/api/public/customer-support',
    apiKey: '1234567890', // Your unique API key
    buttonText: 'Contact Support',
    position: 'bottom-right' // bottom-right, bottom-left, top-right, top-left
  });
</script>
```

**That's it!** The widget will appear on your website.

---

## 📱 Implementation by Technology

### 1. React / Next.js

#### Option A: Next.js (App Router)

**File: `app/layout.js` or `pages/_app.js`**

```jsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        
        <Script 
          src="http://dev.duhanashrah.ai/support-widget.js"
          strategy="afterInteractive"
        />
        <Script id="support-widget-init" strategy="afterInteractive">
          {`
            if (typeof SupportWidget !== 'undefined') {
              SupportWidget.init({
                apiUrl: 'http://dev.duhanashrah.ai/api/api/public/customer-support',
                apiKey: '1234567890',
                buttonText: 'Contact Support',
                position: 'bottom-right'
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
```

#### Option B: React (Create React App)

**File: `public/index.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- ... -->
  </head>
  <body>
    <div id="root"></div>
    
    <!-- Support Widget -->
    <script src="http://dev.duhanashrah.ai/support-widget.js"></script>
    <script>
      window.addEventListener('load', function() {
        if (typeof SupportWidget !== 'undefined') {
          SupportWidget.init({
            apiUrl: process.env.REACT_APP_SUPPORT_API_URL,
            apiKey: process.env.REACT_APP_SUPPORT_API_KEY,
            buttonText: 'Contact Support',
            position: 'bottom-right'
          });
        }
      });
    </script>
  </body>
</html>
```

**File: `.env`**
```
REACT_APP_SUPPORT_API_URL=http://dev.duhanashrah.ai/api/api/public/customer-support
REACT_APP_SUPPORT_API_KEY=1234567890
```

#### Option C: React Component (Dynamic Loading)

**File: `components/SupportWidget.jsx`**

```jsx
import { useEffect } from 'react';

export default function SupportWidget() {
  useEffect(() => {
    // Load script dynamically
    const script = document.createElement('script');
    script.src = 'http://dev.duhanashrah.ai/support-widget.js';
    script.async = true;
    script.onload = () => {
      if (window.SupportWidget) {
        window.SupportWidget.init({
          apiUrl: process.env.REACT_APP_SUPPORT_API_URL,
          apiKey: process.env.REACT_APP_SUPPORT_API_KEY,
          buttonText: 'Contact Support',
          position: 'bottom-right'
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup if needed
      const widget = document.getElementById('support-widget-button');
      if (widget) widget.remove();
    };
  }, []);

  return null; // Widget renders itself
}
```

**Usage:**
```jsx
import SupportWidget from './components/SupportWidget';

function App() {
  return (
    <div>
      {/* Your app content */}
      <SupportWidget />
    </div>
  );
}
```

---

### 2. PHP

#### Option A: Direct HTML (Simple PHP)

**File: `footer.php` or `includes/footer.php`**

```php
<!-- Support Widget -->
<script src="http://dev.duhanashrah.ai/support-widget.js"></script>
<script>
  SupportWidget.init({
    apiUrl: '<?php echo getenv('SUPPORT_API_URL'); ?>',
    apiKey: '<?php echo getenv('SUPPORT_API_KEY'); ?>',
    buttonText: 'Contact Support',
    position: 'bottom-right'
  });
</script>
```

**File: `.env` or `config.php`**
```php
define('SUPPORT_API_URL', 'http://dev.duhanashrah.ai/api/api/public/customer-support');
define('SUPPORT_API_KEY', '1234567890');
```

#### Option B: WordPress

**File: `functions.php` or Plugin**

```php
function add_support_widget() {
    ?>
    <script src="http://dev.duhanashrah.ai/support-widget.js"></script>
    <script>
      SupportWidget.init({
        apiUrl: '<?php echo get_option('support_api_url'); ?>',
        apiKey: '<?php echo get_option('support_api_key'); ?>',
        buttonText: 'Contact Support',
        position: 'bottom-right'
      });
    </script>
    <?php
}
add_action('wp_footer', 'add_support_widget');
```

**Add to WordPress Admin Settings:**
```php
// In your plugin or theme
add_action('admin_init', function() {
    register_setting('support_settings', 'support_api_url');
    register_setting('support_settings', 'support_api_key');
});
```

#### Option C: Laravel

**File: `resources/views/layouts/app.blade.php`**

```blade
<!DOCTYPE html>
<html>
<head>
    <!-- ... -->
</head>
<body>
    @yield('content')
    
    <!-- Support Widget -->
    <script src="http://dev.duhanashrah.ai/support-widget.js"></script>
    <script>
      SupportWidget.init({
        apiUrl: '{{ config('support.api_url') }}',
        apiKey: '{{ config('support.api_key') }}',
        buttonText: 'Contact Support',
        position: 'bottom-right'
      });
    </script>
</body>
</html>
```

**File: `config/support.php`**
```php
<?php
return [
    'api_url' => env('SUPPORT_API_URL', 'http://dev.duhanashrah.ai/api/api/public/customer-support'),
    'api_key' => env('SUPPORT_API_KEY', '1234567890'),
];
```

**File: `.env`**
```
SUPPORT_API_URL=http://dev.duhanashrah.ai/api/api/public/customer-support
SUPPORT_API_KEY=1234567890
```

---

### 3. Python (Django / Flask)

#### Option A: Django

**File: `templates/base.html`**

```html
<!DOCTYPE html>
<html>
<head>
    <!-- ... -->
</head>
<body>
    {% block content %}{% endblock %}
    
    <!-- Support Widget -->
    <script src="http://dev.duhanashrah.ai/support-widget.js"></script>
    <script>
      SupportWidget.init({
        apiUrl: '{{ support_api_url }}',
        apiKey: '{{ support_api_key }}',
        buttonText: 'Contact Support',
        position: 'bottom-right'
      });
    </script>
</body>
</html>
```

**File: `settings.py`**
```python
SUPPORT_API_URL = os.getenv('SUPPORT_API_URL', 'http://dev.duhanashrah.ai/api/api/public/customer-support')
SUPPORT_API_KEY = os.getenv('SUPPORT_API_KEY', '1234567890')
```

**File: `views.py` or `context_processors.py`**
```python
from django.conf import settings

def support_widget_context(request):
    return {
        'support_api_url': settings.SUPPORT_API_URL,
        'support_api_key': settings.SUPPORT_API_KEY,
    }
```

**File: `.env`**
```
SUPPORT_API_URL=http://dev.duhanashrah.ai/api/api/public/customer-support
SUPPORT_API_KEY=1234567890
```

#### Option B: Flask

**File: `templates/base.html`**

```html
<!DOCTYPE html>
<html>
<head>
    <!-- ... -->
</head>
<body>
    {% block content %}{% endblock %}
    
    <!-- Support Widget -->
    <script src="http://dev.duhanashrah.ai/support-widget.js"></script>
    <script>
      SupportWidget.init({
        apiUrl: '{{ config.SUPPORT_API_URL }}',
        apiKey: '{{ config.SUPPORT_API_KEY }}',
        buttonText: 'Contact Support',
        position: 'bottom-right'
      });
    </script>
</body>
</html>
```

**File: `app.py` or `config.py`**
```python
import os
from flask import Flask

app = Flask(__name__)
app.config['SUPPORT_API_URL'] = os.getenv('SUPPORT_API_URL', 'http://dev.duhanashrah.ai/api/api/public/customer-support')
app.config['SUPPORT_API_KEY'] = os.getenv('SUPPORT_API_KEY', '1234567890')
```

---

### 4. Vue.js / Nuxt.js

#### Option A: Nuxt.js

**File: `nuxt.config.js`**

```javascript
export default {
  head: {
    script: [
      {
        src: 'http://dev.duhanashrah.ai/support-widget.js',
        async: true,
        defer: true
      }
    ]
  },
  env: {
    SUPPORT_API_URL: process.env.SUPPORT_API_URL,
    SUPPORT_API_KEY: process.env.SUPPORT_API_KEY
  }
}
```

**File: `plugins/support-widget.client.js`**

```javascript
export default function ({ $config }) {
  if (process.client && window.SupportWidget) {
    window.SupportWidget.init({
      apiUrl: $config.SUPPORT_API_URL,
      apiKey: $config.SUPPORT_API_KEY,
      buttonText: 'Contact Support',
      position: 'bottom-right'
    });
  }
}
```

**File: `.env`**
```
SUPPORT_API_URL=http://dev.duhanashrah.ai/api/api/public/customer-support
SUPPORT_API_KEY=1234567890
```

#### Option B: Vue.js (Vue CLI)

**File: `public/index.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- ... -->
  </head>
  <body>
    <div id="app"></div>
    
    <script src="http://dev.duhanashrah.ai/support-widget.js"></script>
    <script>
      window.addEventListener('load', function() {
        if (window.SupportWidget) {
          window.SupportWidget.init({
            apiUrl: '<%= process.env.VUE_APP_SUPPORT_API_URL %>',
            apiKey: '<%= process.env.VUE_APP_SUPPORT_API_KEY %>',
            buttonText: 'Contact Support',
            position: 'bottom-right'
          });
        }
      });
    </script>
  </body>
</html>
```

---

### 5. Angular

**File: `angular.json`**

```json
{
  "projects": {
    "your-app": {
      "architect": {
        "build": {
          "options": {
            "scripts": [
              "http://dev.duhanashrah.ai/support-widget.js"
            ]
          }
        }
      }
    }
  }
}
```

**File: `src/app/app.component.ts`**

```typescript
import { Component, OnInit } from '@angular/core';

declare var SupportWidget: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  ngOnInit() {
    // Wait for script to load
    setTimeout(() => {
      if (typeof SupportWidget !== 'undefined') {
        SupportWidget.init({
          apiUrl: environment.supportApiUrl,
          apiKey: environment.supportApiKey,
          buttonText: 'Contact Support',
          position: 'bottom-right'
        });
      }
    }, 1000);
  }
}
```

**File: `src/environments/environment.ts`**

```typescript
export const environment = {
  supportApiUrl: 'http://dev.duhanashrah.ai/api/api/public/customer-support',
  supportApiKey: '1234567890'
};
```

---

### 6. Static HTML / Plain JavaScript

**File: `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Website</title>
</head>
<body>
    <!-- Your content -->
    
    <!-- Support Widget -->
    <script src="http://dev.duhanashrah.ai/support-widget.js"></script>
    <script>
      SupportWidget.init({
        apiUrl: 'http://dev.duhanashrah.ai/api/api/public/customer-support',
        apiKey: '1234567890',
        buttonText: 'Contact Support',
        position: 'bottom-right'
      });
    </script>
</body>
</html>
```

---

## 🔧 Configuration Options

### Widget Configuration

```javascript
SupportWidget.init({
  // Required
  apiUrl: 'http://dev.duhanashrah.ai/api/api/public/customer-support',
  
  // Optional
  apiKey: '1234567890',              // Your API key (for tracking)
  buttonText: 'Contact Support',            // Button text
  position: 'bottom-right',                  // bottom-right, bottom-left, top-right, top-left
  zIndex: 9999                               // CSS z-index (default: 9999)
});
```

---

## 📡 API Integration (Without Widget)

If you prefer to integrate directly without the widget, you can use the API directly:

### JavaScript/Fetch

```javascript
// Create ticket
const formData = new FormData();
formData.append('email', 'user@example.com');
formData.append('name', 'John Doe');
formData.append('subject', 'Need Help');
formData.append('message', 'I need assistance with...');
formData.append('category', 'technical');
formData.append('priority', 'medium');
formData.append('api_key', '1234567890');
formData.append('source_url', window.location.href);

// Add files if any
files.forEach(file => {
  formData.append('files', file);
});

fetch('http://dev.duhanashrah.ai/api/api/public/customer-support/tickets', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Ticket created:', data.data.ticket.ticket_number);
  }
});
```

### PHP cURL

```php
$data = [
    'email' => 'user@example.com',
    'name' => 'John Doe',
    'subject' => 'Need Help',
    'message' => 'I need assistance with...',
    'category' => 'technical',
    'priority' => 'medium',
    'api_key' => '1234567890',
    'source_url' => $_SERVER['HTTP_REFERER']
];

$ch = curl_init('http://dev.duhanashrah.ai/api/api/public/customer-support/tickets');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

$response = curl_exec($ch);
$result = json_decode($response, true);

if ($result['success']) {
    echo "Ticket created: " . $result['data']['ticket']['ticket_number'];
}
```

### Python Requests

```python
import requests

data = {
    'email': 'user@example.com',
    'name': 'John Doe',
    'subject': 'Need Help',
    'message': 'I need assistance with...',
    'category': 'technical',
    'priority': 'medium',
    'api_key': '1234567890',
    'source_url': 'https://yourwebsite.com'
}

# With files
files = []
if 'attachment' in request.files:
    files = [('files', open('attachment.pdf', 'rb'))]

response = requests.post(
    'http://dev.duhanashrah.ai/api/api/public/customer-support/tickets',
    data=data,
    files=files
)

result = response.json()
if result['success']:
    print(f"Ticket created: {result['data']['ticket']['ticket_number']}")
```

---

## 🔍 View Tickets API

Users can view their tickets by email:

```javascript
// Get all tickets for an email
fetch('http://dev.duhanashrah.ai/api/api/public/customer-support/tickets?email=user@example.com')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Tickets:', data.data.tickets);
    }
  });

// Get specific ticket
fetch('http://dev.duhanashrah.ai/api/api/public/customer-support/tickets?email=user@example.com&ticket_number=TICKET-20241201-12345')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Ticket:', data.data.ticket);
    }
  });
```

---

## ✅ Testing Checklist

After implementation, test:

- [ ] Widget button appears on the page
- [ ] Clicking button opens the modal
- [ ] Form submission works
- [ ] File upload works (if using)
- [ ] Success message shows ticket number
- [ ] Error messages display correctly
- [ ] "View My Tickets" functionality works
- [ ] Widget works on mobile devices
- [ ] Widget doesn't conflict with your site's CSS/JS

---

## 🐛 Troubleshooting

### Widget not appearing?
- Check browser console for errors
- Verify script URL is accessible
- Ensure script loads before `init()` is called

### API errors?
- Verify API URL is correct
- Check CORS settings (should allow all origins)
- Verify API key format (if using)

### Files not uploading?
- Check file size (max 10MB per file)
- Verify file types are allowed
- Check browser console for errors

---

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify API endpoint is accessible
3. Test with Postman/curl first
4. Contact support with:
   - Error messages
   - Browser console logs
   - API response (if any)

---

## 📝 Summary

**Minimum Implementation (2 lines):**
```html
<script src="http://dev.duhanashrah.ai/support-widget.js"></script>
<script>
  SupportWidget.init({ apiUrl: 'http://dev.duhanashrah.ai/api/api/public/customer-support', apiKey: '1234567890' });
</script>
```

**That's all you need!** The widget handles everything else automatically.

