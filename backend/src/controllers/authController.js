const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sendOtpEmail } = require("../services/emailService");
const generateOtp = require("../utils/generateOtp");
const generateToken = require("../utils/generateToken");

const OTP_EXPIRY_MINUTES = 10;

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const getOtpExpiry = () => new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

const register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry");

    if (existingUser?.isVerified) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const otpExpiry = getOtpExpiry();

    let user = existingUser;
    if (user) {
      user.name = name.trim();
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpiry = otpExpiry;
    } else {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        isVerified: false,
        otp,
        otpExpiry,
      });
    }

    if (existingUser) {
      await user.save();
    }

    await sendOtpEmail({ email: user.email, name: user.name, otp });

    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify the OTP sent to your email.",
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.status(200).json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = getOtpExpiry();
    await user.save();

    await sendOtpEmail({ email: user.email, name: user.name, otp });

    res.status(200).json({ success: true, message: "A new OTP has been sent to your email" });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "Please verify your email before logging in" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
};
