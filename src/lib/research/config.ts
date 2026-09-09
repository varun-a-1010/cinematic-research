import "server-only";

export class ResearchConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchConfigurationError";
  }
}

export type ResearchRuntimeConfig = {
  project: string;
  location: string;
  model: string;
  parallelApiKey?: string;
  useMarketplace: boolean;
};

export function getResearchRuntimeConfig(): ResearchRuntimeConfig {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global";
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const parallelApiKey = process.env.PARALLEL_API_KEY?.trim();
  const useMarketplace =
    process.env.PARALLEL_USE_MARKETPLACE?.trim().toLowerCase() === "true";

  if (!project) {
    throw new ResearchConfigurationError(
      "GOOGLE_CLOUD_PROJECT is required to run cinematic research.",
    );
  }

  if (!parallelApiKey && !useMarketplace) {
    throw new ResearchConfigurationError(
      "Set PARALLEL_API_KEY or enable a Parallel Google Cloud Marketplace subscription.",
    );
  }

  return { project, location, model, parallelApiKey, useMarketplace };
}
