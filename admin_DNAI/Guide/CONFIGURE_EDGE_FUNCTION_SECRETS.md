# Configure Edge Function Secrets

This guide shows you exactly how to set the API credentials for your Supabase Edge Function.

## Your API Credentials

Based on your `.env` file:
- **API Key**: `n8n_CnMG-V5oE7H_hzzXv4BMldGSg3kz1lOL`
- **API Secret**: `-b87IuaWxvhomutL67gB4xInJFibvhubcEuIW7zGfgZANh8Z7fch7BeK4zMxlhmU`

## Method 1: Using Supabase CLI

If you're using the CLI, run these commands:

```bash
# Set API URL (replace with your actual backend URL)
supabase secrets set API_URL=https://your-backend-url.com

# Set API Key
supabase secrets set API_KEY=n8n_CnMG-V5oE7H_hzzXv4BMldGSg3kz1lOL

# Set API Secret
supabase secrets set API_SECRET=-b87IuaWxvhomutL67gB4xInJFibvhubcEuIW7zGfgZANh8Z7fch7BeK4zMxlhmU
```

**Important**: Replace `https://your-backend-url.com` with your actual backend API URL.

## Method 2: Using Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on `send-call-logs-report` function
3. Go to **Settings** tab
4. Scroll to **Environment Variables** section
5. Add these three secrets:

   | Variable Name | Value |
   |--------------|-------|
   | `API_URL` | `https://your-backend-url.com` (replace with your actual URL) |
   | `API_KEY` | `n8n_CnMG-V5oE7H_hzzXv4BMldGSg3kz1lOL` |
   | `API_SECRET` | `-b87IuaWxvhomutL67gB4xInJFibvhubcEuIW7zGfgZANh8Z7fch7BeK4zMxlhmU` |

6. Click **Save**

## Verify Secrets Are Set

### Using CLI:
```bash
supabase secrets list
```

You should see all three secrets listed.

### Using Dashboard:
- Go to Edge Function → Settings → Environment Variables
- Verify all three variables are present

## Important Notes

1. **API_URL**: Make sure this points to your actual backend server:
   - Production: `https://api.yourdomain.com`
   - Development: `http://localhost:5000` (only works if using ngrok or similar)
   - Staging: Your staging URL

2. **Security**: 
   - These secrets are encrypted and stored securely by Supabase
   - Never commit these to git
   - If you need to rotate them, create a new API key in Admin Panel

3. **Testing**: After setting secrets, test the function:
   - Use the "Invoke" tab in Dashboard
   - Or use the test command from the deployment guide

## Example: Setting for Local Development

If testing locally with ngrok:

```bash
# Start ngrok
ngrok http 5000

# Get the ngrok URL (e.g., https://abc123.ngrok.io)
# Then set it:
supabase secrets set API_URL=https://abc123.ngrok.io
supabase secrets set API_KEY=n8n_CnMG-V5oE7H_hzzXv4BMldGSg3kz1lOL
supabase secrets set API_SECRET=-b87IuaWxvhomutL67gB4xInJFibvhubcEuIW7zGfgZANh8Z7fch7BeK4zMxlhmU
```

## Troubleshooting

**Function can't connect to API?**
- Check `API_URL` is correct and accessible
- For localhost, use ngrok or similar tunnel
- Check backend server is running

**Authentication errors?**
- Verify API key and secret are correct (no extra spaces)
- Check API key is active in Admin Panel → API Keys
- Check backend logs for authentication errors

**Secrets not working?**
- Make sure you saved them (Dashboard) or they're set (CLI)
- Redeploy the function after setting secrets
- Check function logs for environment variable errors
