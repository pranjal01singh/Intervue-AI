const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
const DEFAULT_OUTPUT_DIMENSIONALITY = 768
const DEFAULT_EMBEDDING_TIMEOUT_MS = 45000

const chunkText = (text = "", maxChars = 1200, overlapChars = 180) => {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return []

  const chunks = []
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + maxChars, normalized.length)
    const chunk = normalized.slice(start, end).trim()
    if (chunk.length >= 80) chunks.push(chunk)
    if (end === normalized.length) break
    start = Math.max(0, end - overlapChars)
  }

  return chunks.slice(0, 20)
}

const cosineSimilarity = (a = [], b = []) => {
  if (!a.length || !b.length || a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]
    normA += a[index] * a[index]
    normB += b[index] * b[index]
  }

  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

const embedText = async (text, taskType = "RETRIEVAL_DOCUMENT", retries = 3, retryDelay = 500) => {
  if (!process.env.GEMINI_API_KEY || !text?.trim()) return null

  const model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
  const outputDimensionality = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || DEFAULT_OUTPUT_DIMENSIONALITY
  const timeoutMs = Number(process.env.GEMINI_EMBEDDING_TIMEOUT_MS) || DEFAULT_EMBEDDING_TIMEOUT_MS

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [{ text }],
          },
          embedContentConfig: {
            taskType,
            outputDimensionality,
          },
        }),
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const statusCode = response.status
        const message = await response.text()
        
        // Retry on 503 (Service Unavailable) or 429 (Too Many Requests)
        if ((statusCode === 503 || statusCode === 429) && attempt < retries - 1) {
          const delayMs = retryDelay * Math.pow(2, attempt)
          console.warn(`Gemini embedding returned ${statusCode}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }
        
        throw new Error(`Gemini embedding request failed (${statusCode}): ${message}`)
      }

      const data = await response.json()
      return data.embedding?.values || null
    } catch (error) {
      // If this is the last retry, throw the error
      if (attempt === retries - 1) {
        throw error
      }
      
      // For other errors, retry with delay
      const delayMs = retryDelay * Math.pow(2, attempt)
      console.warn(`Gemini embedding attempt failed: ${error.message}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

const createResumeEmbeddings = async (rawText = "") => {
  const chunks = chunkText(rawText)
  if (!chunks.length || !process.env.GEMINI_API_KEY) {
    return {
      chunks: chunks.map((text, index) => ({ index, text, embedding: [] })),
      model: process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
      embeddedAt: null,
    }
  }

  const embeddedChunks = []
  let failedEmbeddings = 0

  for (let index = 0; index < chunks.length; index += 1) {
    let embedding = null
    try {
      embedding = await embedText(chunks[index], "RETRIEVAL_DOCUMENT")
    } catch {
      failedEmbeddings += 1
    }
    embeddedChunks.push({ index, text: chunks[index], embedding: embedding || [] })
  }

  if (failedEmbeddings) {
    console.warn(`Resume embeddings unavailable for ${failedEmbeddings}/${chunks.length} chunk(s). Continuing with text-only resume context.`)
  }

  return {
    chunks: embeddedChunks,
    model: process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    embeddedAt: failedEmbeddings === chunks.length ? null : new Date(),
  }
}

const findRelevantResumeChunks = async ({ resumeEmbeddings, query, limit = 5 }) => {
  const chunks = resumeEmbeddings?.chunks || []
  if (!chunks.length) return []

  const embeddedChunks = chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length)

  if (!process.env.GEMINI_API_KEY || !embeddedChunks.length) {
    return chunks.slice(0, limit).map((chunk) => chunk.text)
  }

  let queryEmbedding = null
  try {
    queryEmbedding = await embedText(query, "RETRIEVAL_QUERY")
  } catch {
    console.warn("Resume query embedding unavailable. Using text-order resume context fallback.")
  }
  if (!queryEmbedding) return chunks.slice(0, limit).map((chunk) => chunk.text)

  return embeddedChunks
    .map((chunk) => ({
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((chunk) => chunk.text)
}

module.exports = {
  chunkText,
  createResumeEmbeddings,
  findRelevantResumeChunks,
}
