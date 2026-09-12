# WebSocket Nginx Configuration for Socket.IO

## Problem
WebSocket connections are failing because nginx is not configured to proxy WebSocket upgrade requests.

## Solution
Add the following configuration to your nginx server block for `devstage.duhanashrah.ai`:

```nginx
# Add this map in the http block (outside server block)
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# In your server block for devstage.duhanashrah.ai, add:

# Socket.IO WebSocket proxy
location /socket.io/ {
    proxy_pass http://localhost:8800;  # Your backend port
    proxy_http_version 1.1;
    
    # WebSocket upgrade headers (CRITICAL)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket specific timeouts (for long-lived connections)
    proxy_read_timeout 86400;  # 24 hours
    proxy_send_timeout 86400;
    proxy_connect_timeout 60;
}

# API Logs namespace (if needed separately)
location /api-logs/ {
    proxy_pass http://localhost:8800;
    proxy_http_version 1.1;
    
    # WebSocket upgrade headers
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket timeouts
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

## Steps to Apply

1. SSH into your server
2. Edit nginx config: `sudo nano /etc/nginx/sites-available/devstage.duhanashrah.ai` (or wherever your config is)
3. Add the `map` block in the `http` section (usually in `/etc/nginx/nginx.conf`)
4. Add the `location /socket.io/` block in your server block
5. Test config: `sudo nginx -t`
6. Reload nginx: `sudo systemctl reload nginx`

## Verification

After applying the config, check the browser console. You should see:
- `✅ WebSocket: Connected to /api-logs namespace`
- Transport should show either `websocket` or `polling`

## Current Workaround

The client is configured to use **polling first**, which works even without WebSocket support, but it's less efficient. Once nginx is configured, it will automatically upgrade to WebSocket.

