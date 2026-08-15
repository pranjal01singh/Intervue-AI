const express = require("express");
const path = require("path");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const interviewRoutes = require("./routes/interviewRoutes");

const connectDB = require("./config/db");
const app = express();

app.use(async (req, res, next) => {
  if (process.env.VERCEL) {
    await connectDB().catch(console.error);
  }
  next();
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
const uploadPath = process.env.VERCEL ? "/tmp/uploads" : path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadPath));

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

module.exports = app;
