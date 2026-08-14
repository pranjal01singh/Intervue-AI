# AI Mock Interview Platform - Deployment Guide

## Pre-Deployment Verification ✅

All tests have passed:
- ✅ Backend compiles and starts successfully
- ✅ Frontend builds with Vite successfully
- ✅ All dependencies are secure (0 vulnerabilities)
- ✅ Code quality checks pass (ESLint clean)
- ✅ Database connection verified
- ✅ All API routes configured

---

## Production Deployment Steps

### Phase 1: Production Server Setup

#### 1. Backend Deployment

**Step 1.1: Install dependencies**
```bash
cd backend
npm install --production
```

**Step 1.2: Create production environment file**
```bash
# Copy .env.example and update with production values
cp .env.example .env
```

**Update `.env` with production values:**
```
PORT=5000
MONGODB_URI=<production_mongodb_connection_string>
JWT_SECRET=<generate_new_secure_jwt_secret>
EMAIL_USER=<production_email>
EMAIL_PASS=<production_email_password>
DNS_SERVERS=8.8.8.8,1.1.1.1
GEMINI_API_KEY=<production_gemini_key>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
NODE_ENV=production
```

**Step 1.3: Set up process manager (recommended: PM2)**
```bash
npm install -g pm2

# Start backend with PM2
pm2 start src/server.js --name "interview-backend" --env production

# Enable auto-restart on system reboot
pm2 startup
pm2 save
```

**Step 1.4: Verify backend is running**
```bash
curl http://localhost:5000/api/health
# Should return: {"success":true,"message":"API is running"}
```

#### 2. Frontend Deployment

**Step 2.1: Create production environment file**
```bash
# In frontend directory
echo 'VITE_API_URL=https://your-production-domain.com/api' > .env.production
```

**Step 2.2: Build for production**
```bash
cd frontend
npm run build
```

**Step 2.3: Deploy built files**
- Output is in `dist/` folder
- Upload to your web server (Nginx, Apache, Vercel, Netlify, etc.)

**For Nginx deployment:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/interview-platform/dist;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### Phase 2: SSL/HTTPS Setup (Required for Microphone/Camera)

**Using Let's Encrypt with Certbot:**
```bash
sudo certbot certonly --standalone -d your-domain.com
sudo certbot renew --dry-run
```

**Update Nginx for HTTPS:**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Rest of configuration same as above
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

### Phase 3: Database Setup

**MongoDB Atlas (Cloud) - Recommended:**
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Add database user
4. Get connection string
5. Update MONGODB_URI in backend .env

**Connection string format:**
```
mongodb+srv://username:password@cluster-name.mongodb.net/interview-platform?retryWrites=true&w=majority
```

**MongoDB Local (Self-hosted):**
```bash
# Install MongoDB
# Start MongoDB service
mongod --dbpath /data/db

# Update MONGODB_URI
MONGODB_URI=mongodb://localhost:27017/interview-platform
```

---

### Phase 4: Email Service Setup

**Gmail Configuration (App Password):**
1. Enable 2-factor authentication
2. Generate app password: https://myaccount.google.com/apppasswords
3. Update EMAIL_USER and EMAIL_PASS in .env

**Alternative Email Providers:**
- SendGrid: Update nodemailer config
- AWS SES: Update nodemailer config
- Brevo (Sendinblue): Update nodemailer config

---

### Phase 5: Gemini API Setup

1. Create account at https://ai.google.dev
2. Enable Gemini API
3. Generate API key
4. Update GEMINI_API_KEY in .env
5. Monitor quota and usage

---

### Phase 6: Performance Optimization

**Backend Optimization:**
```bash
# Enable gzip compression in app.js (update if not present)
app.use(compression());

# Enable CORS for production domain (app.js)
cors({
  origin: process.env.CORS_ORIGIN || "https://your-domain.com",
  credentials: true
})
```

**Frontend Optimization:**
```bash
# Current bundle size: 530.97 kB (161.24 kB gzipped)
# Consider enabling:
# - Code splitting for MediaPipe
# - Lazy loading for routes
# - Image optimization
```

**Server Optimization:**
- Enable HTTP/2
- Enable gzip compression
- Set cache headers
- Use CDN for static files
- Enable database indexing

---

### Phase 7: Monitoring & Logging

**Backend Logging:**
```bash
# Install logging package
npm install winston

# Monitor with PM2
pm2 logs interview-backend
```

**Monitor uptime:**
- Use UptimeRobot, Pingdom, or similar
- Monitor API endpoints regularly

---

### Phase 8: Backup & Recovery

**Database Backups:**
```bash
# MongoDB Atlas: Enable automatic backups (default: daily)

# Local MongoDB backup
mongodump --db interview-platform --out /backups/

# Restore
mongorestore --db interview-platform /backups/interview-platform/
```

**Application Backup:**
```bash
# Regular backups of uploaded resumes
rsync -av ./uploads/resumes /backups/
```

---

## Post-Deployment Verification

### Checklist
- [ ] Backend API responds at https://your-domain.com/api/health
- [ ] Frontend loads without errors
- [ ] Login/Registration works
- [ ] OTP email sending works
- [ ] Resume upload works (PDF parsing)
- [ ] Interview creation works
- [ ] Camera & microphone permissions work
- [ ] Audio/video recording works
- [ ] AI responses are generated
- [ ] Interview completion and feedback work
- [ ] Database queries are fast (<100ms)
- [ ] SSL certificate is valid
- [ ] Monitoring is set up
- [ ] Backups are running

### Test Users
Create test accounts to verify full workflow:
1. Register with email
2. Verify OTP
3. Complete profile
4. Upload resume
5. Start interview
6. Complete interview
7. View feedback

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
pm2 logs interview-backend

# Check port is not in use
lsof -i :5000

# Check environment variables
echo $MONGODB_URI
```

### MongoDB connection fails
```bash
# Check connection string
# Verify database exists
# Check network access rules (MongoDB Atlas)
# Test with mongo shell
mongo "mongodb+srv://..."
```

### Frontend doesn't load
```bash
# Check API_URL environment variable
# Check CORS headers
curl -H "Origin: https://your-domain.com" http://localhost:5000/api/health

# Check web server logs
# Check browser console for errors
```

### Email not sending
```bash
# Check Gmail app password is correct
# Check SMTP server settings
# Check email quota limits
```

### Camera/Microphone not working
- HTTPS is required (not HTTP)
- Check browser permissions
- Check firewall rules
- Test with different browser

---

## Security Recommendations

1. **Environment Variables:**
   - Never commit .env to version control
   - Rotate secrets every 90 days
   - Use different secrets for prod/staging

2. **Database:**
   - Enable authentication
   - Use strong passwords
   - Restrict network access (IP whitelisting)
   - Enable encryption at rest

3. **API Security:**
   - Implement rate limiting
   - Add request validation
   - Use HTTPS only
   - Set security headers

4. **File Uploads:**
   - Validate file types server-side
   - Scan uploads with antivirus
   - Store in secure location
   - Limit file size

5. **Monitoring:**
   - Enable access logs
   - Monitor error rates
   - Set up alerts
   - Regular security audits

---

## Scaling Considerations

For high traffic:
1. Use load balancer (Nginx, HAProxy)
2. Horizontal scaling with multiple backend instances
3. Database read replicas
4. Caching layer (Redis)
5. CDN for frontend assets
6. Queue system for background jobs (email, embeddings)

---

## Rollback Procedure

If issues occur:

```bash
# Keep previous versions
cp -r dist dist.backup
cp -r node_modules node_modules.backup

# Rollback to previous version
rm -rf dist
cp -r dist.previous dist

# Restart services
pm2 restart interview-backend

# Monitor
pm2 logs interview-backend
```

---

## Support & Maintenance

- Monitor application performance
- Keep dependencies updated
- Review logs regularly
- Test backup recovery quarterly
- Update security patches immediately
- Plan capacity upgrades as needed

---

**Deployment Date:** [Your Date]  
**Deployed By:** [Your Name]  
**Environment:** Production  
**Status:** Ready for Deployment ✅
