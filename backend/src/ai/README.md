# PanelFlow AI / RAG

PanelFlow AI is an extension of the existing Express + Prisma application. PostgreSQL remains authoritative; `rag_sources` tracks index state and `rag_chunks` stores LangChain pgvector chunks.

## Architecture

```text
Authenticated HTTP request
        |
        v
  requireAuth (existing)
        |
        v
   LangGraph workflow
   authorize -> classify
       |          |
       |     DB / HYBRID / RAG
       |          |
       +-----> retrieve/query
                   |
                synthesize
                   |
             answer + citations
```

The graph is intentionally explicit. Scheduling mutations are not delegated to a free-form agent. AI may prepare a cancellation target, but the existing booking service performs the mutation only after a frontend confirmation.

## Indexed canonical data

The current schema provides useful textual context in:

- bookings and `inviteeNotes`
- event type titles/descriptions
- positions and descriptions
- panels and interviewer membership
- contacts and notes
- interview feedback, subject to the existing feedback reveal rule

There is no uploaded-document or transcript model in the current application, so the ingestion abstraction is prepared for future source types without inventing those models today.

## Authorization

RAG retrieval is filtered using metadata derived on the server from the authenticated user. Interviewer retrieval requires the user's id and current `aiAccessVersion` to match the indexed chunk. Panel membership changes increment that version before asynchronous reindexing, so a revoked membership fails closed immediately.

The vector index is never treated as the source of truth. Retrieval also requires a live `RagSource` record, which prevents deleted canonical records from surfacing through a stale vector if a vector-delete call fails.

## Index synchronization

The existing service layer triggers best-effort indexing after canonical CRUD operations. The request is not blocked on an embedding call. Errors are logged without document contents, and the canonical scheduling path continues working when the AI provider is unavailable.

Use the admin endpoint to rebuild the entire index after deployment or data migration:

```http
POST /api/ai/index/rebuild
```

It returns source/chunk/failure counts. The endpoint is authenticated and admin-only.

## Environment

Copy the new entries from `.env.example` into the backend environment:

```text
GEMINI_API_KEY=
AI_GEMINI_MODEL=gemini-3.8-flash
GROQ_API_KEY=
AI_GROQ_MODEL=qwen/qwen3.8-27b
AI_EMBEDDING_MODEL=gemini-embedding-001
AI_EMBEDDING_DIMENSIONS=1536
AI_RETRIEVAL_TOP_K=8
AI_MIN_SIMILARITY=0.25
AI_CHUNK_SIZE=900
AI_CHUNK_OVERLAP=120
AI_TIMEOUT_MS=30000
AI_MAX_CONTEXT_CHARS=24000
AI_MAX_OUTPUT_CHARS=8000
AI_GROQ_FALLBACK_COOLDOWN_MS=60000
AI_GEMINI_FALLBACK_COOLDOWN_MS=60000
```

The backend uses the existing `DATABASE_URL` for both Prisma and pgvector.

## Local setup

1. Install backend dependencies with network access. This archive was prepared in an offline sandbox, so the pre-existing `backend/package-lock.json` could not be regenerated with the new AI dependencies. Run `npm install` once after extracting the project to refresh the lockfile; CI can then use `npm ci`.
2. Apply migrations:

```bash
cd backend
npx prisma migrate deploy
```

3. Start the backend and frontend as usual.
4. Log in as an admin and call `POST /api/ai/index/rebuild` once for existing seed data.
5. Open **Ask PanelFlow** from the existing sidebar.

## Regeneration and maintenance

Indexing is content-hash based. Re-running an unchanged source is a no-op. Updates replace that source's chunks. Booking reindexing also replaces feedback child chunks belonging to that booking. Deleting a source removes its vector chunks and its `RagSource` registry entry.

The database schema can be regenerated because the raw `vector` column is intentionally represented as Prisma `Unsupported("vector")`; LangChain owns vector reads/writes.


## Model providers

PanelFlow AI uses Groq as the primary model provider and Gemini as a fallback when Groq is unavailable because of rate limits, quota exhaustion, or transient provider failures. All Groq calls use the model configured by `AI_GROQ_MODEL` (the default is `qwen/qwen3.8-27b`); Gemini calls use `AI_GEMINI_MODEL`. The fallback is provider-level and does not change authorization or tool permissions.

Gemini is also the embedding provider (`gemini-embedding-001`, 1536 dimensions). Groq does not provide the required LangChain embedding integration for this pgvector index, so when Gemini embeddings are unavailable during chat, retrieval falls back to PostgreSQL full-text/phrase retrieval with the same authorization filters. Rebuilding the vector index still requires `GEMINI_API_KEY`.

Current defaults are configurable through `AI_GEMINI_MODEL` and `AI_GROQ_MODEL`. The Groq provider is primary, and `qwen/qwen3.8-27b` is used for all Groq calls by default.

## AI security boundary

The AI endpoint is intentionally not a general-purpose chatbot. Requests are screened for common prompt-injection/jailbreak patterns, secret/credential extraction attempts, arbitrary SQL/shell execution requests, cross-user data requests, and obvious unrelated requests. The classifier has an explicit `OUT_OF_SCOPE` state, and unknown operations cannot fall through to retrieval.

Retrieved meeting/contact/feedback content is treated as untrusted data. Instruction-like text is scrubbed before it reaches synthesis, and the synthesis prompt explicitly forbids following instructions contained inside retrieved records. Model output is sanitized for common API-key/private-key patterns and is length-bounded.

Only explicit PanelFlow application tools are available. There is no arbitrary Prisma, SQL, filesystem, shell, HTTP, or code-execution tool exposed to the model. Mutating actions remain behind existing application services and user confirmation.

These protections are defense-in-depth controls rather than a guarantee against every possible adversarial prompt. The authoritative boundary remains PanelFlow authentication, authorization, and application services; the model never receives arbitrary database or operating-system tools.
