# Public Mail API - Demo Request Body

Example request bodies for testing the Public Mail API endpoint.

---

## 🚀 Quick Demo

### Basic Example

```json
{
  "to": "recipient@example.com",
  "from": "sender@example.com",
  "subject": "Test Email from Public API",
  "html": "<h1>Hello!</h1><p>This is a test email sent via the Public Mail API.</p>",
  "api_key": "your-api-key-here"
}
```

---

## 📧 Complete Examples

### Example 1: Simple HTML Email

```json
{
  "to": "john.doe@example.com",
  "from": "noreply@duhanashrah.ai",
  "subject": "Welcome to Our Service",
  "html": "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body><h1 style='color: #74317e;'>Welcome!</h1><p>Thank you for joining us.</p><p>Best regards,<br>The Team</p></body></html>",
  "api_key": "23222KKSKAJ2322I2I"
}
```

### Example 2: Rich HTML Email with Styling

```json
{
  "to": "customer@example.com",
  "from": "support@duhanashrah.ai",
  "subject": "Order Confirmation - Order #12345",
  "html": "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;}h1{color:#74317e;}table{width:100%;border-collapse:collapse;margin:20px 0;}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd;}th{background-color:#74317e;color:white;}.button{display:inline-block;padding:12px 24px;background-color:#74317e;color:white;text-decoration:none;border-radius:8px;margin-top:20px;}</style></head><body><h1>Order Confirmation</h1><p>Dear Customer,</p><p>Thank you for your order! Your order has been received and is being processed.</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Price</th></tr></thead><tbody><tr><td>Product A</td><td>2</td><td>$50.00</td></tr><tr><td>Product B</td><td>1</td><td>$30.00</td></tr></tbody><tfoot><tr><td colspan='2'><strong>Total</strong></td><td><strong>$80.00</strong></td></tr></tfoot></table><p>We'll send you another email when your order ships.</p><a href='https://example.com/orders' class='button'>View Order Status</a><p>Best regards,<br>The Team</p></body></html>",
  "api_key": "23222KKSKAJ2322I2I"
}
```

### Example 3: Newsletter Style Email

```json
{
  "to": "subscriber@example.com",
  "from": "newsletter@duhanashrah.ai",
  "subject": "Monthly Newsletter - January 2024",
  "html": "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>body{font-family:'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background-color:#f5f5f5;}.container{background-color:white;padding:30px;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;border-radius:8px;margin-bottom:30px;text-align:center;}.content{padding:20px 0;}.footer{text-align:center;color:#666;font-size:12px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;}.article{margin-bottom:30px;padding-bottom:20px;border-bottom:1px solid #eee;}.article h2{color:#74317e;margin-top:0;}.article p{color:#555;}.read-more{display:inline-block;padding:10px 20px;background-color:#74317e;color:white;text-decoration:none;border-radius:8px;margin-top:10px;}</style></head><body><div class='container'><div class='header'><h1>Monthly Newsletter</h1><p>January 2024 Edition</p></div><div class='content'><div class='article'><h2>Latest Updates</h2><p>We're excited to share our latest product updates and improvements. This month, we've added several new features that will enhance your experience.</p><a href='#' class='read-more'>Read More</a></div><div class='article'><h2>Upcoming Events</h2><p>Join us for our upcoming webinar on February 15th, where we'll discuss the future of our platform and answer your questions.</p><a href='#' class='read-more'>Register Now</a></div><div class='article'><h2>Special Offer</h2><p>This month only! Get 20% off on all premium plans. Use code: NEWYEAR2024 at checkout.</p><a href='#' class='read-more'>Get Started</a></div></div><div class='footer'><p>You're receiving this email because you subscribed to our newsletter.</p><p><a href='#'>Unsubscribe</a> | <a href='#'>Update Preferences</a></p><p>&copy; 2024 Your Company. All rights reserved.</p></div></div></body></html>",
  "api_key": "23222KKSKAJ2322I2I"
}
```

### Example 4: Transactional Email (Password Reset)

```json
{
  "to": "user@example.com",
  "from": "noreply@duhanashrah.ai",
  "subject": "Password Reset Request",
  "html": "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background-color:#f5f5f5;}.container{background-color:white;padding:40px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}.logo{text-align:center;margin-bottom:30px;}.content{padding:20px 0;}.button{display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;border-radius:8px;margin:20px 0;font-weight:bold;}.warning{background-color:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0;border-radius:4px;}.footer{text-align:center;color:#666;font-size:12px;margin-top:30px;padding-top:20px;border-top:1px solid #eee;}</style></head><body><div class='container'><div class='logo'><h1 style='color:#74317e;margin:0;'>Password Reset</h1></div><div class='content'><p>Hello,</p><p>We received a request to reset your password. Click the button below to create a new password:</p><div style='text-align:center;'><a href='https://example.com/reset-password?token=abc123xyz' class='button'>Reset Password</a></div><div class='warning'><strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</div><p>This link will expire in 1 hour for security reasons.</p><p>If the button doesn't work, copy and paste this link into your browser:</p><p style='word-break:break-all;color:#666;font-size:12px;'>https://example.com/reset-password?token=abc123xyz</p></div><div class='footer'><p>This is an automated email. Please do not reply to this message.</p><p>&copy; 2024 Your Company. All rights reserved.</p></div></div></body></html>",
  "api_key": "23222KKSKAJ2322I2I"
}
```

### Example 5: Minimal Plain Email

```json
{
  "to": "test@example.com",
  "from": "sender@example.com",
  "subject": "Simple Test Email",
  "html": "<p>This is a simple email with minimal HTML.</p>",
  "api_key": "23222KKSKAJ2322I2I"
}
```

---

## 🧪 Testing with cURL

### cURL Command Example

```bash
curl -X POST https://duhanashrah.ai/api/public/mail \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "from": "sender@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1><p>This is a test email.</p>",
    "api_key": "23222KKSKAJ2322I2I"
  }'
```

### cURL with Local Server

```bash
curl -X POST http://localhost:5000/api/public/mail \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "from": "sender@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1><p>This is a test email.</p>",
    "api_key": "your-api-key-here"
  }'
```

---

## 📝 Testing with Postman

1. **Method:** POST
2. **URL:** `https://duhanashrah.ai/api/public/mail` (or `http://localhost:5000/api/public/mail`)
3. **Headers:**
   - `Content-Type: application/json`
4. **Body (raw JSON):**

```json
{
  "to": "recipient@example.com",
  "from": "sender@example.com",
  "subject": "Test Email from Postman",
  "html": "<!DOCTYPE html><html><body><h1 style='color: #74317e;'>Hello from Postman!</h1><p>This email was sent using the Public Mail API.</p></body></html>",
  "api_key": "23222KKSKAJ2322I2I"
}
```

---

## ✅ Expected Success Response

```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": {
    "to": "recipient@example.com",
    "from": "sender@example.com",
    "subject": "Test Email"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## ❌ Expected Error Responses

### Invalid API Key

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Missing Required Fields

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required fields: to, subject",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Invalid Email Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid recipient email format",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 💡 Tips

1. **Replace `api_key`** with your actual API key from `.env` file (`MAIL_API_KEY`)
2. **Use valid email addresses** that you have access to for testing
3. **The `from` email** must be verified in your SendGrid account
4. **HTML is supported** - you can use full HTML with inline CSS
5. **Test with simple HTML first** before trying complex templates
6. **Check spam folder** if email doesn't arrive in inbox
7. **Rate limiting:** Maximum 20 requests per minute

---

## 🔗 Related Documentation

- [Public Mail API Setup Guide](./PUBLIC_MAIL_API_SETUP.md)
- Backend API documentation

