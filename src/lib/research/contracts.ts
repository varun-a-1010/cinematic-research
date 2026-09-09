import { z } from "zod";

export const ResearchOptionsSchema = z.object({
  mode: z.enum(["discover", "lineage"]).default("discover"),
  multilingual: z.boolean().default(false),
});
export type ResearchOptions = z.infer<typeof ResearchOptionsSchema>;

export const ResearchContextSchema = z.object({
  sources: z.array(z.object({
    sourceId: z.string(),
    category: z.enum(["primary", "scholarly", "professional criticism", "database", "unverified"]),
    language: z.string(),
    rationale: z.string(),
  })),
  connections: z.array(z.object({
    fromId: z.string(),
    toId: z.string(),
    kind: z.enum(["Documented influence", "Shared movement", "Critical comparison", "Inferred parallel", "Disputed"]),
    explanation: z.string(),
    sourceIds: z.array(z.string()),
  })),
  coverage: z.array(z.object({
    language: z.string(),
    finding: z.string(),
    sourceIds: z.array(z.string()),
  })),
  gaps: z.array(z.string()),
  passages: z.array(z.object({
    sourceId: z.string(),
    original: z.string(),
    translation: z.string(),
    language: z.string(),
  })).default([]),
});

export const ResearchPlanSchema = z.object({
  centralIdea: z.string().min(1),
  includeWhen: z.array(z.string().min(1)).min(2).max(5),
  excludeWhen: z.array(z.string().min(1)).min(2).max(5),
  evidenceStandard: z.string().min(1),
  researchAngles: z.array(z.string().min(1)).min(2).max(5),
});

export const CandidateDraftSchema = z.object({
  title: z.string().min(1),
  year: z.number().int().min(1880).max(2100).nullable(),
  country: z.string(),
  director: z.string(),
  status: z.enum(["verified", "borderline", "rejected"]),
  confidence: z.number().int().min(0).max(100),
  thesis: z.string().min(1),
  dimensions: z
    .array(
      z.object({
        label: z.string().min(1),
        met: z.boolean(),
        sourceIds: z.array(z.string()),
      }),
    )
    .min(2)
    .max(6),
  evidence: z
    .array(
      z.object({
        kind: z.string().min(1),
        claim: z.string().min(1),
        sourceIds: z.array(z.string()).min(1),
      }),
    )
    .min(1)
    .max(6),
  caveat: z.string().min(1),
});

export const CandidateDraftsSchema = z.object({
  candidates: z.array(CandidateDraftSchema).min(2).max(8),
});

export const ResearchSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
});

export const ResearchResultSchema = z.object({
  query: z.string(),
  options: ResearchOptionsSchema.optional(),
  context: ResearchContextSchema.optional(),
  brief: ResearchPlanSchema.omit({ researchAngles: true }),
  researchAngles: z.array(z.string()),
  sources: z.array(ResearchSourceSchema),
  candidates: z.array(
    CandidateDraftSchema.extend({
      id: z.string(),
    }),
  ),
  metrics: z.object({
    searchAngles: z.number().int().nonnegative(),
    sourcesReviewed: z.number().int().nonnegative(),
    candidatesTested: z.number().int().nonnegative(),
  }),
});

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>;
export type CandidateDraft = z.infer<typeof CandidateDraftSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type ResearchResult = z.infer<typeof ResearchResultSchema>;

export const researchPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "centralIdea",
    "includeWhen",
    "excludeWhen",
    "evidenceStandard",
    "researchAngles",
  ],
  properties: {
    centralIdea: { type: "string" },
    includeWhen: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    excludeWhen: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    evidenceStandard: { type: "string" },
    researchAngles: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
  },
} as const;

export const candidateDraftsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "year",
          "country",
          "director",
          "status",
          "confidence",
          "thesis",
          "dimensions",
          "evidence",
          "caveat",
        ],
        properties: {
          title: { type: "string" },
          year: {
            anyOf: [
              { type: "integer" },
              { type: "null" },
            ],
          },
          country: { type: "string" },
          director: { type: "string" },
          status: {
            type: "string",
            enum: ["verified", "borderline", "rejected"],
          },
          confidence: { type: "integer" },
          thesis: { type: "string" },
          dimensions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "met", "sourceIds"],
              properties: {
                label: { type: "string" },
                met: { type: "boolean" },
                sourceIds: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "claim", "sourceIds"],
              properties: {
                kind: { type: "string" },
                claim: { type: "string" },
                sourceIds: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          caveat: { type: "string" },
        },
      },
    },
  },
} as const;
