const mongoose = require("mongoose")

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trackId: {
      type: String,
      required: true,
    },
    trackTitle: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      required: true,
    },
    resumeUrl: {
      type: String,
      required: true,
    },
    resumeUploadedAt: {
      type: Date,
      required: true,
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
    },
    detectedDomain: {
      type: String,
      default: "",
    },
    questions: {
      type: [
        {
          text: {
            type: String,
            required: true,
          },
          category: {
            type: String,
            enum: ["intro", "resume", "external", "communication", "follow-up", "unknown"],
            default: "external",
          },
          difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium",
          },
        },
      ],
      default: [],
    },
    questionSource: {
      type: String,
      default: "fallback",
    },
    relevantResumeChunks: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "started", "completed"],
      default: "pending",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    answeredCount: {
      type: Number,
      default: 0,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    transcripts: {
      type: [
        {
          speaker: String, // 'ai' or 'user'
          text: String,
          timestamp: Date,
          questionIndex: Number,
          questionText: String,
          interim: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
    answerAnalysis: {
      type: [
        {
          question: String,
          answer: String,
          questionIndex: Number,
          category: String,
          wordCount: Number,
          fillerCount: Number,
          responseSeconds: Number,
          confidenceScore: Number,
          skipped: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
    liveMetrics: {
      confidence: {
        type: Number,
        default: null,
      },
      avgResponseSeconds: {
        type: Number,
        default: null,
      },
      fillerWords: {
        type: Number,
        default: 0,
      },
      answeredQuestions: {
        type: Number,
        default: 0,
      },
    },
    visualMetrics: {
      eyeContactScore: {
        type: Number,
        default: null,
      },
      attentionScore: {
        type: Number,
        default: null,
      },
      faceDetectedRatio: {
        type: Number,
        default: null,
      },
      lookingAwayCount: {
        type: Number,
        default: 0,
      },
      totalSamples: {
        type: Number,
        default: 0,
      },
      questionMetrics: {
        type: [
          {
            questionIndex: Number,
            faceDetectedRatio: Number,
            eyeContactRatio: Number,
            attentionScore: Number,
            lookingAwayCount: Number,
            samples: Number,
          },
        ],
        default: [],
      },
    },
    feedback: {
      overallScore: {
        type: Number,
        default: null,
      },
      scores: {
        communication: {
          type: Number,
          default: null,
        },
        confidence: {
          type: Number,
          default: null,
        },
        technicalSkills: {
          type: Number,
          default: null,
        },
        answerDepth: {
          type: Number,
          default: null,
        },
        eyeContact: {
          type: Number,
          default: null,
        },
        attention: {
          type: Number,
          default: null,
        },
      },
      strengths: {
        type: [
          {
            title: String,
            text: String,
          },
        ],
        default: [],
      },
      improvementAreas: {
        type: [
          {
            title: String,
            text: String,
          },
        ],
        default: [],
      },
      questionBreakdown: {
        type: [
          {
            question: String,
            feedback: String,
            score: Number,
            skipped: {
              type: Boolean,
              default: false,
            },
          },
        ],
        default: [],
      },
      source: {
        type: String,
        default: "fallback",
      },
      isCheat: {
        type: Boolean,
        default: false,
      },
      generatedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model("Interview", interviewSchema)
