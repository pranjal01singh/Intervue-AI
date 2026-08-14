const express = require("express")
const multer = require("multer")
const protect = require("../middleware/authMiddleware")
const { uploadResume, startInterview, permissionAccess, createFollowUpQuestion, completeInterview, getInterviewById, getInterviewHistory } = require("../controllers/interviewController")

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.post("/resume", protect, upload.single("resume"), uploadResume)
router.post("/start", protect, startInterview)
router.post("/permissions", protect, permissionAccess)
router.post("/follow-up", protect, createFollowUpQuestion)
router.post("/end", protect, completeInterview)
router.get("/details/:id", protect, getInterviewById)
router.get("/history", protect, getInterviewHistory)

module.exports = router
