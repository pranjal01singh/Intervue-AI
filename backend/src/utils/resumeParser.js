const { PDFParse } = require("pdf-parse")

const SECTION_ALIASES = {
  skills: ["skills", "technical skills", "core skills", "key skills", "technologies", "tools", "tech stack"],
  projects: ["projects", "personal projects", "academic projects", "professional projects"],
  experience: ["experience", "work experience", "professional experience", "employment", "internship", "internships"],
  education: ["education", "academic background", "academics", "qualification", "qualifications"],
  certifications: ["certifications", "certificates", "achievements", "awards"],
}

const SECTION_LABELS = Object.entries(SECTION_ALIASES).flatMap(([key, aliases]) => aliases.map((label) => ({ key, label })))

const KNOWN_SKILLS = [
  "javascript",
  "typescript",
  "react",
  "redux",
  "next.js",
  "node.js",
  "express",
  "mongodb",
  "mongoose",
  "mysql",
  "postgresql",
  "python",
  "java",
  "c++",
  "c#",
  "html",
  "css",
  "tailwind",
  "bootstrap",
  "git",
  "github",
  "docker",
  "aws",
  "azure",
  "firebase",
  "rest api",
  "graphql",
  "machine learning",
  "deep learning",
  "nlp",
  "openai",
  "langchain",
  "tensorflow",
  "pytorch",
  "pandas",
  "numpy",
  "scikit-learn",
]

const cleanText = (value = "") =>
  value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const normalizeLine = (line) =>
  line
    .replace(/^[\s\-*•·]+/, "")
    .replace(/\s+/g, " ")
    .trim()

const unique = (items) => [...new Set(items.map((item) => item.trim()).filter(Boolean))]

const getSectionKey = (line) => {
  const normalized = line
    .toLowerCase()
    .replace(/[:|]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  const match = SECTION_LABELS.find(({ label }) => normalized === label || normalized.startsWith(`${label} `))
  return match?.key || null
}

const splitIntoSections = (text) => {
  const sections = {}
  let currentKey = "summary"

  text.split("\n").forEach((rawLine) => {
    const line = normalizeLine(rawLine)
    if (!line) return

    const sectionKey = getSectionKey(line)
    if (sectionKey) {
      currentKey = sectionKey
      sections[currentKey] = sections[currentKey] || []
      const remainder = line.replace(new RegExp(`^(${SECTION_ALIASES[sectionKey].join("|")})[:\\s-]*`, "i"), "").trim()
      if (remainder) sections[currentKey].push(remainder)
      return
    }

    sections[currentKey] = sections[currentKey] || []
    sections[currentKey].push(line)
  })

  return sections
}

const extractContactInfo = (text) => {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null
  const phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4}/)?.[0] || null
  const links = unique(text.match(/https?:\/\/[^\s)]+|(?:linkedin|github)\.com\/[^\s)]+/gi) || [])

  return { email, phone, links }
}

const extractSkills = (text, sections) => {
  const fromSkillSection = (sections.skills || [])
    .flatMap((line) => line.split(/[,|/;•·]| {2,}/))
    .map((skill) => normalizeLine(skill))
    .filter((skill) => skill.length >= 2 && skill.length <= 40)

  const lowerText = text.toLowerCase()
  const fromKnownSkills = KNOWN_SKILLS.filter((skill) => lowerText.includes(skill))

  return unique([...fromSkillSection, ...fromKnownSkills]).slice(0, 60)
}

const extractEntries = (lines = [], maxItems = 8) => {
  const entries = []
  let current = []

  lines.forEach((line) => {
    const normalizedLine = normalizeLine(line)
    const looksLikeBullet = /^[-*•·]/.test(line)
    const looksLikeTitle = normalizedLine.length <= 70 && normalizedLine.split(/\s+/).length <= 8 && !/[.,;:]$/.test(normalizedLine)

    if ((looksLikeBullet || looksLikeTitle) && current.length > 1) {
      entries.push(current.join(" "))
      current = []
    }
    current.push(normalizedLine)
  })

  if (current.length) entries.push(current.join(" "))

  return unique(entries)
    .filter((entry) => entry.length >= 8)
    .slice(0, maxItems)
}

const extractImportantDetails = (sections) => ({
  summary: (sections.summary || []).slice(0, 6).join(" ").slice(0, 1000),
  education: extractEntries(sections.education, 6),
  experience: extractEntries(sections.experience, 8),
  certifications: extractEntries(sections.certifications, 8),
})

const parseResumePdf = async (buffer) => {
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    const text = cleanText(result.text || "")
    const sections = splitIntoSections(text)

    return {
      rawText: text,
      skills: extractSkills(text, sections),
      projects: extractEntries(sections.projects, 10),
      contact: extractContactInfo(text),
      importantDetails: extractImportantDetails(sections),
      parsedAt: new Date(),
    }
  } finally {
    await parser.destroy()
  }
}

module.exports = parseResumePdf
