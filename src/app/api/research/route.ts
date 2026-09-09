import { NextResponse } from "next/server";
import { z } from "zod";
import { ResearchConfigurationError } from "@/lib/research/config";
import { runResearch } from "@/lib/research/pipeline";
import { ResearchOptionsSchema } from "@/lib/research/contracts";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  query: z.string().trim().min(20).max(800),
  options: ResearchOptionsSchema.default({ mode: "discover", multilingual: false }),
});

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

export async function POST(request: Request) {
  let input: z.infer<typeof RequestSchema>;
  try {
    input = RequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        {
          code: "invalid_request",
          message: "Enter a specific cinematic research question between 20 and 800 characters.",
        },
        { status: 400 },
      );
    }
    throw error;
  }

  if (request.headers.get("accept")?.includes("application/x-ndjson")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => { try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { /* Client disconnected. */ } };
        try {
          const result = await runResearch(input.query, input.options, (message) => send({ type: "progress", message }));
          send({ type: "result", result });
        } catch (error) {
          console.error("Research pipeline failed", error);
          send({ type: "error", message: error instanceof ResearchConfigurationError ? error.message : "The research run could not finish. Please retry; upstream capacity may be temporarily unavailable." });
        } finally {
          try { controller.close(); } catch { /* Client disconnected. */ }
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  }

  try {
    const result = await runResearch(input.query, input.options);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ResearchConfigurationError) {
      return NextResponse.json(
        { code: "configuration_required", message: error.message },
        { status: 503 },
      );
    }

    if (getErrorStatus(error) === 429) {
      console.error("Research pipeline reached an upstream capacity limit", error);
      return NextResponse.json(
        {
          code: "upstream_capacity",
          message: "Gemini capacity is temporarily unavailable. Retry the research run.",
        },
        { status: 503 },
      );
    }

    console.error("Research pipeline failed", error);
    return NextResponse.json(
      {
        code: "research_failed",
        message:
          "The research run could not produce a sufficiently grounded result. Try a more specific question.",
      },
      { status: 502 },
    );
  }
}
