import "server-only";

import { GoogleGenAI, type GroundingMetadata } from "@google/genai";
import { z } from "zod";
import {
  getResearchRuntimeConfig,
  type ResearchRuntimeConfig,
} from "./config";

type GroundedResponse = {
  text: string;
  grounding: GroundingMetadata;
};

function createClient(config: ResearchRuntimeConfig) {
  return new GoogleGenAI({
    enterprise: true,
    project: config.project,
    location: config.location,
  });
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}

async function withCapacityRetry<T>(operation: () => Promise<T>): Promise<T> {
  const delays = [2_000, 6_000, 18_000];

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delay = delays[attempt];
      if (getErrorStatus(error) !== 429 || delay === undefined) {
        throw error;
      }

      console.warn(
        `[research] Gemini capacity limit; retrying in ${delay / 1_000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function generateStructured<T>(options: {
  prompt: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
}): Promise<T> {
  const config = getResearchRuntimeConfig();
  const client = createClient(config);
  const response = await withCapacityRetry(() =>
    client.models.generateContent({
      model: config.model,
      contents: options.prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: options.jsonSchema,
      },
    }),
  );

  if (!response.text) {
    throw new Error("Gemini returned no structured response.");
  }

  return options.validator.parse(JSON.parse(response.text));
}

export async function generateWithParallel(prompt: string, retried = false): Promise<GroundedResponse> {
  const config = getResearchRuntimeConfig();
  const client = createClient(config);
  const response = await withCapacityRetry(() =>
    client.models.generateContent({
      model: config.model,
      contents: prompt,
      config: {
        tools: [
          {
            parallelAiSearch: {
              apiKey: config.parallelApiKey,
              customConfigs: {
                mode: "advanced",
                max_results: 12,
                excerpts: {
                  max_chars_per_result: 6000,
                  max_chars_total: 60000,
                },
              },
            },
          },
        ],
      },
    }),
  );

  const grounding = response.candidates?.[0]?.groundingMetadata;
  if (!response.text) {
    throw new Error("Gemini returned no grounded research response.");
  }
  if (!grounding?.groundingChunks?.length || !grounding.webSearchQueries?.length) {
    if (!retried) {
      console.warn("[research] Missing grounding metadata; retrying search once");
      return generateWithParallel(prompt + "\nYou must execute the Parallel search tool and return source-grounded findings. Do not provide an answer from memory.", true);
    }
    throw new Error(
      "Parallel grounding did not execute. The research run was stopped instead of returning an ungrounded answer.",
    );
  }

  return { text: response.text, grounding };
}
