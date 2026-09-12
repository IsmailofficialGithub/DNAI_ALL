# Quick Deploy: Supabase Edge Function

Quick reference for deploying the call logs email function.

## Prerequisites Checklist

- [ ] API endpoint working at `/api/genie/calls/export-and-email`
- [ ] API key and secret created (Admin Panel → API Keys)
- [ ] Supabase project access

## Quick Steps (Dashboard Method)

### 1. Create Function
1. Supabase Dashboard → **Edge Functions** → **Create function**
2. Name: `send-call-logs-report`
3. Copy code from `supabase/functions/send-call-logs-report/index.ts`
4. Click **Deploy**

### 2. Set Secrets
In function **Settings** → **Environment Variables**:

| Variable | Value |
|----------|-------|
| `API_URL` | Your backend URL (e.g., `https://api.yourdomain.com`) |
| `API_KEY` | Your API key |
| `API_SECRET` | Your API secret |

### 3. Set Up Webhook
1. Dashboard → **Database** → **Webhooks** → **Create webhook**
2. **Table**: `genie_scheduled_calls`
3. **Events**: Update
4. **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report`
5. **Headers**: 
   - `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - `Content-Type: application/json`
6. **Filter** (optional):
   ```sql
   (new.calls_completed >= new.contacts_count AND new.contacts_count > 0)
   AND (old.calls_completed < old.contacts_count OR old.calls_completed IS NULL)
   ```

### 4. Test
1. Complete a small test campaign
2. Check agent's email for Excel report
3. Check function logs for errors

## Quick Steps (CLI Method)

```bash
# 1. Install CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref YOUR_PROJECT_REF

# 4. Deploy function
supabase functions deploy send-call-logs-report

# 5. Set secrets
supabase secrets set API_URL=https://your-api-url.com
supabase secrets set API_KEY=your-api-key
supabase secrets set API_SECRET=your-api-secret
```

Then set up webhook (same as Dashboard method, step 3).

## Function URL Format

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-call-logs-report
```

Find `YOUR_PROJECT_REF` in: Dashboard → Settings → API → Project URL

## Troubleshooting

**Function not triggering?**
- Check webhook is active
- Check function logs
- Verify secrets are set

**API call failing?**
- Verify `API_URL` is correct
- Check API key is active
- Check backend logs

**Need help?** See full guide: `SUPABASE_EDGE_FUNCTION_DEPLOYMENT.md`
