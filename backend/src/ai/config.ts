import { AppError } from '../utils/errors';

export class AiConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 503);
  }
}

export const aiConfig = {
  get geminiModel() {
    return process.env.AI_GEMINI_MODEL || 'gemini-3.8-flash';
  },
  get groqModel() {
    return process.env.AI_GROQ_MODEL || 'qwen/qwen3.8-27b';
  },
  get embeddingModel() {
    return process.env.AI_EMBEDDING_MODEL || 'gemini-embedding-001';
  },
  get embeddingDimensions() {
    return Number(process.env.AI_EMBEDDING_DIMENSIONS || 1536);
  },
  get topK() {
    return Math.max(1, Math.min(20, Number(process.env.AI_RETRIEVAL_TOP_K || 8)));
  },
  get minSimilarity() {
    return Math.max(0, Math.min(1, Number(process.env.AI_MIN_SIMILARITY || 0.25)));
  },
  get chunkSize() {
    return Math.max(300, Number(process.env.AI_CHUNK_SIZE || 900));
  },
  get chunkOverlap() {
    return Math.max(0, Math.min(300, Number(process.env.AI_CHUNK_OVERLAP || 120)));
  },
  get requestTimeoutMs() {
    return Math.max(5_000, Number(process.env.AI_TIMEOUT_MS || 30_000));
  },
  get maxContextCharacters() {
    return Math.max(4_000, Number(process.env.AI_MAX_CONTEXT_CHARS || 24_000));
  },
  get maxOutputCharacters() {
    return Math.max(1_000, Number(process.env.AI_MAX_OUTPUT_CHARS || 8_000));
  },
  get groqFallbackCooldownMs() {
    return Math.max(5_000, Number(
      process.env.AI_GROQ_FALLBACK_COOLDOWN_MS
      || 60_000,
    ));
  },
  get geminiFallbackCooldownMs() {
    return Math.max(5_000, Number(process.env.AI_GEMINI_FALLBACK_COOLDOWN_MS || 60_000));
  },
  hasGeminiKey() {
    return Boolean(process.env.GEMINI_API_KEY);
  },
  hasGroqKey() {
    return Boolean(process.env.GROQ_API_KEY);
  },
  requireChatProviderKey() {
    if (!this.hasGeminiKey() && !this.hasGroqKey()) {
      throw new AiConfigurationError(
        'PanelFlow AI is not configured. Set GEMINI_API_KEY and/or GROQ_API_KEY.',
      );
    }
  },
  requireEmbeddingKey() {
    if (this.embeddingDimensions !== 1536) {
      throw new AiConfigurationError(
        'AI_EMBEDDING_DIMENSIONS must remain 1536 for the current pgvector schema.',
      );
    }
    if (!this.hasGeminiKey()) {
      throw new AiConfigurationError(
        'Gemini is required for vector indexing. Set GEMINI_API_KEY or use the lexical retrieval fallback for chat-only deployments.',
      );
    }
  },
};
