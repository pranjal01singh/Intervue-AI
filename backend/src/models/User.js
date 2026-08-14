const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    resumeUrl: {
      type: String,
      default: null,
    },
    resumeUploadedAt: {
      type: Date,
      default: null,
    },
    resumeParsedData: {
      rawText: {
        type: String,
        default: "",
      },
      skills: {
        type: [String],
        default: [],
      },
      projects: {
        type: [String],
        default: [],
      },
      contact: {
        email: {
          type: String,
          default: null,
        },
        phone: {
          type: String,
          default: null,
        },
        links: {
          type: [String],
          default: [],
        },
      },
      importantDetails: {
        summary: {
          type: String,
          default: "",
        },
        education: {
          type: [String],
          default: [],
        },
        experience: {
          type: [String],
          default: [],
        },
        certifications: {
          type: [String],
          default: [],
        },
      },
      parsedAt: {
        type: Date,
        default: null,
      },
    },
    resumeEmbeddings: {
      model: {
        type: String,
        default: null,
      },
      embeddedAt: {
        type: Date,
        default: null,
      },
      chunks: {
        type: [
          {
            index: Number,
            text: String,
            embedding: {
              type: [Number],
              default: [],
            },
          },
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
