#!/bin/bash

# Deployment script for inbound.duhanashrah.ai
# This script automates the deployment process on Ubuntu server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="inbound.duhanashrah.ai"
REPO_URL="https://github.com/FurqanAfridi/inbound-calling-saas.git"
APP_DIR="/var/www/inbound-calling-saas"
DEPLOY_DIR="$APP_DIR/current"
BACKUP_DIR="$APP_DIR/backups"
NODE_VERSION="18"

echo -e "${GREEN}Starting deployment for $DOMAIN...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Install required packages
echo -e "${YELLOW}Installing required packages...${NC}"
apt-get install -y curl git nginx nodejs npm build-essential certbot python3-certbot-nginx

# Install Node.js 18 if not already installed
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt "$NODE_VERSION" ]; then
    echo -e "${YELLOW}Installing Node.js $NODE_VERSION...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    npm install -g pm2
fi

# Create application directory
echo -e "${YELLOW}Creating application directories...${NC}"
mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$DEPLOY_DIR"

# Clone or update repository
if [ -d "$APP_DIR/repo" ]; then
    echo -e "${YELLOW}Updating repository...${NC}"
    cd "$APP_DIR/repo"
    git fetch origin
    git reset --hard origin/master
else
    echo -e "${YELLOW}Cloning repository...${NC}"
    cd "$APP_DIR"
    git clone "$REPO_URL" repo
fi

# Create backup of current deployment
if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
    echo -e "${YELLOW}Creating backup...${NC}"
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    cp -r "$DEPLOY_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    echo -e "${GREEN}Backup created: $BACKUP_NAME${NC}"
fi

# Build application
echo -e "${YELLOW}Building application...${NC}"
cd "$APP_DIR/repo"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci --production=false

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}ERROR: .env.production file not found!${NC}"
    echo -e "${YELLOW}Please create .env.production file with required environment variables${NC}"
    exit 1
fi

# Build the application
echo -e "${YELLOW}Building React application...${NC}"
npm run build

# Deploy build to current directory
echo -e "${YELLOW}Deploying build...${NC}"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
cp -r build/* "$DEPLOY_DIR/"

# Set permissions
echo -e "${YELLOW}Setting permissions...${NC}"
chown -R www-data:www-data "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"

# Setup Nginx configuration
echo -e "${YELLOW}Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    root $DEPLOY_DIR;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Handle React Router (SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx

# Setup SSL with Let's Encrypt
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${YELLOW}Setting up SSL certificate...${NC}"
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@duhanashrah.ai
else
    echo -e "${YELLOW}Renewing SSL certificate...${NC}"
    certbot renew --quiet
fi

# Setup auto-renewal cron job
if ! crontab -l | grep -q "certbot renew"; then
    echo -e "${YELLOW}Setting up SSL auto-renewal...${NC}"
    (crontab -l 2>/dev/null; echo "0 0,12 * * * certbot renew --quiet") | crontab -
fi

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}Application is available at: https://$DOMAIN${NC}"
