# Cinematic Research

A film-discovery and research workspace for filmmakers, essayists, and fans asking nuanced questions that go beyond genre or title matching.

For example: “Which films make a city increasingly threatening over a single night—not merely use it as a backdrop? How do they create that effect?”

## How it works

1. Gemini turns the question into a research brief with inclusion and exclusion criteria.
2. Parallel Search, used through Gemini's external grounding integration, supplies sources for candidate discovery.
3. A separate grounded verification pass challenges the candidates.
4. Gemini structures an evidence ledger with verified, borderline, and rejected candidates, claim-level source references, and caveats.

The workspace supports multilingual research with original passages and model translations, and lineage research that distinguishes documented influence from critical comparison. These are model assessments, not guarantees: inspect linked sources before relying on an interpretation. Research runs on demand; there is no curated film database.

## Local setup

Use Node.js 22 or newer, a Google Cloud project with billing and Vertex AI enabled, and a Parallel API key (or supported Marketplace subscription).

```bash
npm ci
cp .env.example .env.local
# Fill in .env.local with your Google Cloud project and Parallel configuration.
gcloud auth application-default login
npm run dev -- --port 3100
```

Open http://localhost:3100. Credentials remain server-side. The configured model is `gemini-3.8-flash`, with the Vertex AI location set to `global`. Your credentials must have permission to invoke it in your project.

## Checks

```bash
npm run lint
npm run build
npx tsc --noEmit
```

The build generates Next.js route types, so run it before a standalone TypeScript check on a fresh checkout.

## Deployment

The included Dockerfile builds a standalone Next.js server listening on port 8080, suitable for Google Cloud Run. Configure the variables listed in `.env.example` on the service, supply the Parallel key through Secret Manager, and grant its runtime service account Vertex AI access. Do not upload `.env.local` or local credentials.

Research invokes multiple upstream model/search requests and may take several minutes. Configure the hosting request timeout accordingly. Public deployment should include appropriate access controls and usage limits to avoid unrestricted API spending.

## Limitations

Source coverage varies by language and film. Model translations and evidence classifications may be wrong. Invalid queries, missing configuration, capacity errors, and insufficient grounding are surfaced by the research API. This repository uses Gemini on Vertex AI through the Google GenAI SDK; it does not claim a separate managed Agent Engine deployment.

## License

MIT. Retrieved third-party source content remains subject to its respective rights and terms.

## Gemini availability

The primary remains `gemini-3.8-flash`. On HTTP 429, 500, 502, 503, or 504,
each inference retries once after a short jittered delay, then tries
`gemini-3.7-flash` and `gemini-3.6-flash` in order. Set the comma-separated
`GEMINI_FALLBACK_MODELS` variable to override that list; an empty value disables
cross-model fallback. Authentication, validation, and other non-transient errors
are not retried. Fallback model names are logged without prompts or credentials.
This improves availability but cannot guarantee success when all models are busy.
