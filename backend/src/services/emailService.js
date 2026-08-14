const createTransporter = require("../config/nodemailer");

const sendOtpEmail = async ({ email, name, otp }) => {
  try {
    const transporter = createTransporter();
    const fromEmail = process.env.EMAIL_USER.trim();

    await transporter.sendMail({
      from: `"AI Mock Interview Platform" <${fromEmail}>`,
      to: email,
      subject: "Verify your email address",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2>Email verification</h2>
          <p>Hello ${name},</p>
          <p>Your verification OTP is:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
          <p>This OTP expires in 10 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send OTP email:", error.message);
    throw new Error("Unable to send OTP email. Please try again later.");
  }
};

module.exports = { sendOtpEmail };
