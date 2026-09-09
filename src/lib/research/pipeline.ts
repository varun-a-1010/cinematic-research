import "server-only";
import { z } from "zod";

import {
  CandidateDraftsSchema,
  ResearchPlanSchema,
  ResearchResultSchema,
  ResearchContextSchema,
  type ResearchOptions,
  candidateDraftsJsonSchema,
  researchPlanJsonSchema,
  type CandidateDraft,
  type ResearchResult,
  type ResearchSource,
} from "./contracts";
import { generateStructured, generateWithParallel } from "./gemini";

const CANDIDATE_START = "<candidate_titles>";
const CANDIDATE_END = "</candidate_titles>";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function extractCandidateTitles(text: string): string[] {
  const start = text.indexOf(CANDIDATE_START);
  const end = text.indexOf(CANDIDATE_END);
  if (start < 0 || end <= start) return [];

  return text
    .slice(start + CANDIDATE_START.length, end)
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

function collectSources(
  groundedRuns: Awaited<ReturnType<typeof generateWithParallel>>[],
): ResearchSource[] {
  const byUrl = new Map<string, Omit<ResearchSource, "id">>();

  for (const run of groundedRuns) {
    for (const chunk of run.grounding.groundingChunks ?? []) {
      const web = chunk.web;
      if (!web?.uri) continue;
      byUrl.set(web.uri, {
        url: web.uri,
        title: web.title?.trim() || web.domain?.trim() || "Untitled source",
        domain: web.domain?.trim() || new URL(web.uri).hostname,
      });
    }
  }

  return Array.from(byUrl.values()).map((source, index) => ({
    id: `S${index + 1}`,
    ...source,
  }));
}

function sourceCatalog(sources: ResearchSource[]) {
  return sources
    .map(
      (source) =>
        `[${source.id}] ${source.title} | ${source.domain} | ${source.url}`,
    )
    .join("\n");
}

function normalizeCandidates(
  candidates: CandidateDraft[],
  sourceIds: Set<string>,
): ResearchResult["candidates"] {
  const usedIds = new Set<string>();

  return candidates.map((candidate, index) => {
    const baseId = slugify(`${candidate.title}-${candidate.year ?? "unknown"}`) || `film-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return {
      ...candidate,
      id,
      dimensions: candidate.dimensions.map((dimension) => ({
        ...dimension,
        sourceIds: dimension.sourceIds.filter((sourceId) => sourceIds.has(sourceId)),
      })),
      evidence: candidate.evidence
        .map((evidence) => ({
          ...evidence,
          sourceIds: evidence.sourceIds.filter((sourceId) => sourceIds.has(sourceId)),
        }))
        .filter((evidence) => evidence.sourceIds.length > 0),
    };
  });
}

export async function runResearch(query: string, options: ResearchOptions = { mode: "discover", multilingual: false }): Promise<ResearchResult> {
  const researchInstructions = [
    options.mode === "lineage"
      ? "Trace development over time. Search for filmmaker statements about influence, shared movements, and published comparisons. Similarity and chronological order do not prove influence. Report absence of documented links."
      : "Discover useful film references and test their fit.",
    options.multilingual
      ? "Actively issue searches in relevant original languages using original film titles and local terminology. Search at least two relevant non-English languages when the subject permits. Identify each language searched, sources found, and coverage gaps. Preserve original titles. Where source text is accessible, include short original-language supporting passages (at most 20 words per source) with an English translation and source URL. Omit passages when exact text is unavailable. Do not claim multilingual coverage from English articles about foreign films."
      : "Use English-language sources. Report coverage limitations.",
    "Classify sources by the actual material: primary interview, scholarly work, professional criticism, database, or unverified. Record why. Never infer authority from a domain alone. Report disagreement and unmet evidence requirements.",
  ].join("\n");
  console.info("[research] planning started");
  const plan = await generateStructured({
    prompt: `You are the planning stage of a cinematic reference research agent.

Turn the user's question into a rigorous, editable research brief. Preserve the user's actual intent instead of broadening it into genre similarity. Research angles should name genuinely different evidentiary approaches, such as filmmaker interviews, criticism, scholarship, production history, or analysis of craft.

User question:
${query}`,
    jsonSchema: researchPlanJsonSchema,
    validator: ResearchPlanSchema,
  });
  console.info("[research] planning completed");

  console.info("[research] discovery started");
  const discovery = await generateWithParallel(`You are the discovery stage of a cinematic reference research agent. Use Parallel web grounding extensively. Do not answer from memory.

User question:
${query}

Research brief:
${researchInstructions}
Central idea: ${plan.centralIdea}
Include when:
${plan.includeWhen.map((item) => `- ${item}`).join("\n")}
Exclude when:
${plan.excludeWhen.map((item) => `- ${item}`).join("\n")}
Evidence standard: ${plan.evidenceStandard}
Research angles:
${plan.researchAngles.map((item) => `- ${item}`).join("\n")}

Find a diverse pool of plausible films. Prefer primary sources, serious criticism, scholarship, cinematography or craft analysis, festival material, and archival sources. Treat database tags, listicles, and popularity as leads rather than evidence. Explain the evidence and uncertainty for each candidate.

End with a machine-readable list containing only film title and year, one per line, inside these exact tags:
${CANDIDATE_START}
Film title (year)
${CANDIDATE_END}`);
  console.info("[research] discovery completed");

  const candidateTitles = extractCandidateTitles(discovery.text);
  if (candidateTitles.length < 2) {
    throw new Error("The discovery stage did not produce a usable candidate pool.");
  }

  console.info("[research] verification started");
  const verification = await generateWithParallel(`You are the adversarial verification stage of a cinematic reference research agent. Use Parallel web grounding extensively. Do not rely on the previous memo as evidence.

Original question:
${query}
${researchInstructions}

Central idea: ${plan.centralIdea}
Inclusion criteria:
${plan.includeWhen.map((item) => `- ${item}`).join("\n")}
Exclusion criteria:
${plan.excludeWhen.map((item) => `- ${item}`).join("\n")}
Evidence standard: ${plan.evidenceStandard}

Candidates discovered in the first pass:
${candidateTitles.map((title) => `- ${title}`).join("\n")}

Independently investigate these candidates. For every film, decide whether it is verified, borderline, or rejected. Reject keyword matches that fail the actual cinematic idea. Identify which sources support which claims, flag disagreement, and say what remains uncertain. A famous or intuitively plausible film does not qualify without web evidence.`);
  console.info("[research] verification completed");

  const sources = collectSources([discovery, verification]);
  if (sources.length < 2) {
    throw new Error("The research run did not return enough distinct sources.");
  }

  console.info("[research] synthesis started");
  const drafts = await generateStructured({
    prompt: `You are the synthesis stage of a cinematic reference research agent. Produce a compact, structured candidate ledger from the two grounded research memos below.

Rules:
- Never introduce a film absent from the discovery or verification memo.
- Use verified only when the memos contain strong evidence for the actual brief.
- Include at least one rejected or borderline candidate when the research supports it.
- Every evidence item must cite one or more source IDs from the source catalog.
- Do not invent source IDs, URLs, publications, filmmakers, countries, years, or quotations.
- Keep thesis and caveat concise and useful to a filmmaker.
- Confidence is an uncalibrated estimate of confidence in the classification, including rejection, not a match score.
- Return 2–8 candidates, each with 2–6 dimensions and 1–6 evidence items. Confidence must be an integer from 0 to 100.
- Use borderline if the evidence standard is unmet. Cite concrete claims rather than source counts.

Question:
${query}

Brief:
${JSON.stringify(plan, null, 2)}

Discovery memo:
${discovery.text}

Verification memo:
${verification.text}

Source catalog:
${sourceCatalog(sources)}`,
    jsonSchema: candidateDraftsJsonSchema,
    validator: CandidateDraftsSchema,
  });
  console.info("[research] synthesis completed");

  const validSourceIds = new Set(sources.map((source) => source.id));
  const candidates = normalizeCandidates(drafts.candidates, validSourceIds).filter(
    (candidate) => candidate.evidence.length > 0,
  );
  if (candidates.length < 2) {
    throw new Error("Too few candidates retained valid claim-level evidence.");
  }

  const researchAngles = Array.from(
    new Set([
      ...plan.researchAngles,
      ...(discovery.grounding.webSearchQueries ?? []),
      ...(verification.grounding.webSearchQueries ?? []),
    ]),
  );

  console.info("[research] context started");
  const context = await generateStructured({
    prompt: `Organize the evidence already collected. Do not invent facts or quotes.
Question: ${query}
Instructions: ${researchInstructions}
Films (use these exact IDs for connection endpoints): ${JSON.stringify(candidates.map(({ id, title, year }) => ({ id, title, year })))}
Sources: ${sourceCatalog(sources)}
Discovery: ${discovery.text}
Verification: ${verification.text}
Classify only sources whose content is described in the memos; otherwise use unverified and language Unknown.
Connections: ${options.mode === "lineage" ? "Return only supported connections between the listed films. Documented influence requires an explicit attributed statement; use Inferred parallel for your own comparison. Cite sources for every connection. Empty is acceptable." : "Return an empty array."}
Coverage: report languages actually searched, identifying sources or an empty sourceIds array for no evidence found.
Gaps: identify unmet evidence standards, absent primary sources, uncertain classifications, and language gaps. Category labels are model assessments, not human certification.
Passages: copy only exact original-language passages already present in the memos, with source IDs, language and an English translation. Never reconstruct a quote. Empty is acceptable.`,
    jsonSchema: z.toJSONSchema(ResearchContextSchema),
    validator: ResearchContextSchema,
  });
  const filmIds = new Set(candidates.map((candidate) => candidate.id));
  context.sources = context.sources.filter((source) => validSourceIds.has(source.sourceId));
  context.connections = context.connections
    .map((connection) => ({ ...connection, sourceIds: connection.sourceIds.filter((id) => validSourceIds.has(id)) }))
    .filter((connection) => filmIds.has(connection.fromId) && filmIds.has(connection.toId) && connection.fromId !== connection.toId && connection.sourceIds.length > 0);
  context.coverage = context.coverage.map((item) => ({ ...item, sourceIds: item.sourceIds.filter((id) => validSourceIds.has(id)) }));
  context.passages = context.passages.filter((passage) =>
    validSourceIds.has(passage.sourceId) && passage.original.trim().length > 0 &&
    (discovery.text.includes(passage.original) || verification.text.includes(passage.original)),
  );
  for (const candidate of candidates) {
    const citedIds = new Set(candidate.evidence.flatMap((item) => item.sourceIds));
    const citedSources = sources.filter((source) => citedIds.has(source.id));
    const domains = new Set(citedSources.map((source) => new URL(source.url).hostname.replace(/^www\./, "")));
    const hasSubstantiveSource = context.sources.some((source) =>
      citedIds.has(source.sourceId) &&
      ["primary", "scholarly", "professional criticism"].includes(source.category),
    );
    if (candidate.status === "verified" && (domains.size < 2 || !hasSubstantiveSource)) {
      candidate.status = "borderline";
      candidate.caveat += " Evidence gate: requires two distinct source domains and at least one source assessed as primary, scholarly, or professional criticism.";
      context.gaps.push(`${candidate.title}: insufficient source diversity or substantive evidence for verified status.`);
    }
  }

  return ResearchResultSchema.parse({
    query,
    options,
    context,
    brief: {
      centralIdea: plan.centralIdea,
      includeWhen: plan.includeWhen,
      excludeWhen: plan.excludeWhen,
      evidenceStandard: plan.evidenceStandard,
    },
    researchAngles,
    sources,
    candidates,
    metrics: {
      searchAngles: researchAngles.length,
      sourcesReviewed: sources.length,
      candidatesTested: candidateTitles.length,
    },
  });
}
