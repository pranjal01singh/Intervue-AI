# AI Mock Interview Platform - Development & Testing Guide

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ (or Node 20 LTS recommended)
- MongoDB (local or Atlas)
- Gemini API key
- Gmail account with app password

### Step 1: Setup Environment

```bash
# Clone or navigate to project
cd AI-mock-Interview-platfrom

# Backend setup
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev

# In another terminal, Frontend setup
cd frontend
npm install
npm run dev

# Frontend will be at http://localhost:5173
# Backend will be at http://localhost:5000
```

### Step 2: Environment Configuration

**Backend `.env`** (backend/.env):
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/interview-platform
JWT_SECRET=your-secret-key-change-in-production
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-3.1-flash-lite
```

**Frontend `.env`** (frontend/.env):
```
VITE_API_URL=http://localhost:5000/api
```

### Step 3: Test the Application

#### Manual Testing Workflow:

1. **Register New User**
   - Go to http://localhost:5173/register
   - Fill in name, email, password
   - Check console or email for OTP
   - Verify OTP at http://localhost:5173/verify-otp

2. **Login**
   - Go to http://localhost:5173/login
   - Use registered credentials
   - Should redirect to dashboard

3. **Dashboard**
   - View available interview tracks
   - Click "Start Interview Setup"

4. **Interview Setup**
   - Upload PDF resume
   - Select interview mode (Express, Standard, etc.)
   - Review generated questions
   - Start interview

5. **Live Interview**
   - Allow camera and microphone permissions
   - Answer AI questions
   - Use Next Question button or Auto Advance
   - End interview

6. **Feedback**
   - View interview performance metrics
   - Review transcripts
   - Check AI evaluation

---

## Project Structure

```
backend/
├── src/
│   ├── app.js              # Express app configuration
│   ├── server.js           # Server entry point
│   ├── config/
│   │   ├── db.js           # MongoDB connection
│   │   └── nodemailer.js   # Email configuration
│   ├── controllers/
│   │   ├── authController.js
│   │   └── interviewController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   └── Interview.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── interviewRoutes.js
│   ├── services/
│   │   ├── aiInterviewService.js      # Gemini API calls
│   │   ├── emailService.js
│   │   └── resumeEmbeddingService.js
│   └── utils/
│       ├── generateOtp.js
│       ├── generateToken.js
│       └── resumeParser.js

frontend/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── Button.jsx
│   │   ├── InputField.jsx
│   │   ├── Loader.jsx
│   │   └── ProtectedRoute.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── useAuth.js
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── VerifyOtp.jsx
│   │   ├── Dashboard.jsx
│   │   ├── InterviewSetup.jsx
│   │   ├── InterviewLive.jsx
│   │   ├── InterviewFeedback.jsx
│   │   └── NotFound.jsx
│   ├── routes/
│   │   └── AppRoutes.jsx
│   └── services/
│       ├── authService.js
│       ├── axiosInstance.js
│       └── interviewService.js
```

---

## Key Technologies

### Backend
- **Express.js** - REST API framework
- **MongoDB/Mongoose** - Database & ODM
- **JWT** - Authentication
- **Bcryptjs** - Password hashing
- **Nodemailer** - Email sending
- **Multer** - File uploads
- **Google Gemini API** - AI interview generation & evaluation

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **MediaPipe** - Computer vision (camera/pose detection)
- **Web Speech API** - Speech recognition & synthesis

---

## Testing

### Run Tests

```bash
# Frontend linting
cd frontend
npm run lint

# Frontend build
npm run build

# Backend (manual testing only currently)
cd backend
npm run dev
```

### Test API Endpoints (Postman/curl)

```bash
# Health check
curl http://localhost:5000/api/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get user (requires JWT token)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Upload resume (requires JWT token)
curl -X POST http://localhost:5000/api/interview/resume \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "resume=@resume.pdf"
```

---

## Common Issues & Solutions

### Issue: "MONGODB_URI is required"
**Solution:** Ensure `.env` file exists in backend directory with MONGODB_URI set

### Issue: OTP not sending
**Solution:** 
- Check email credentials in .env
- Enable "Less secure app access" for Gmail
- Use Gmail app password (recommended)

### Issue: Camera/Microphone not working
**Solution:**
- Must be on HTTPS (even localhost might need special handling)
- Check browser permissions
- Allow permissions when prompted

### Issue: Interview Live page hangs
**Solution:**
- Check Gemini API key is valid
- Check API quota hasn't been exceeded
- Check network connection
- Look at browser console for errors

### Issue: Resume parsing fails
**Solution:**
- Ensure PDF is text-based (not image/scanned)
- File size under 5MB
- Valid PDF format

---

## Performance Tips

### Frontend
1. Enable Vite source maps only in dev mode
2. Use lazy loading for page components
3. Memoize expensive computations
4. Optimize MediaPipe model loading

### Backend
1. Add database indexes for frequently queried fields
2. Cache resume embeddings
3. Implement request rate limiting
4. Use connection pooling

### Database
```javascript
// Recommended indexes
db.users.createIndex({ email: 1 })
db.interviews.createIndex({ userId: 1 })
db.interviews.createIndex({ createdAt: -1 })
```

---

## Debugging

### Backend Debugging

```bash
# Run with debugging enabled
node --inspect src/server.js

# Chrome DevTools: chrome://inspect
```

### Frontend Debugging

```bash
# React DevTools browser extension
# Redux DevTools (if using Redux)
# Use browser console: console.log()
```

### Network Debugging

```bash
# Browser Network tab (F12)
# Check request/response headers
# Verify CORS headers
curl -i http://localhost:5000/api/health
```

---

## Code Standards

### Naming Conventions
- Variables/functions: `camelCase`
- Components: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

### File Organization
- Group related functionality together
- Keep files under 300 lines
- One component per file

### Comments
- Comment complex logic
- Document function parameters
- Add TODOs for future work

### Error Handling
```javascript
// Backend
res.status(400).json({ success: false, message: "Error description" })

// Frontend
try {
  const result = await apiCall()
} catch (error) {
  console.error("Descriptive error:", error.message)
  setError(error.response?.data?.message || "Failed to process")
}
```

---

## Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete deployment instructions.

Quick summary:
```bash
# Backend
npm install --production
npm start

# Frontend
npm run build
# Upload dist/ folder to web server
```

---

## Contact & Support

For issues or questions:
1. Check this guide first
2. Review code comments
3. Check error logs
4. Debug in browser/terminal

---

**Last Updated:** 2026-08-14  
**Status:** Ready for Development & Deployment ✅
