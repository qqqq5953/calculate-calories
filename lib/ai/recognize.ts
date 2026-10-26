import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "@/lib/env";
import { foodNameInstruction, IMAGE_INSTRUCTION, SYSTEM_PROMPT, textInstruction } from "./prompt";
import { recognitionSchema, type Recognition } from "./schema";

export class AiRecognitionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiRecognitionError";
  }
}

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 }));

type UserContent = Anthropic.MessageParam["content"];

async function run(content: UserContent): Promise<Recognition> {
  let lastError: unknown;
  // SDK 已經會重試網路錯誤；這裡再多一次是為了處理格式錯誤或拒答
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic().messages.parse({
        model: env.aiModel(),
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        output_config: { effort: "low", format: zodOutputFormat(recognitionSchema) },
        messages: [{ role: "user", content }],
      });
      if (response.stop_reason === "refusal") {
        throw new AiRecognitionError("model refused");
      }
      if (response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new AiRecognitionError(`no parsed output (stop_reason=${response.stop_reason})`);
      }
      return response.parsed_output;
    } catch (err) {
      lastError = err;
      console.warn(`AI recognition attempt ${attempt + 1} failed`, err);
    }
  }
  throw new AiRecognitionError("recognition failed", { cause: lastError });
}

export function recognizeImage(jpeg: Buffer): Promise<Recognition> {
  return run([
    {
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") },
    },
    { type: "text", text: IMAGE_INSTRUCTION },
  ]);
}

export function recognizeText(text: string): Promise<Recognition> {
  return run(textInstruction(text));
}

export function estimateFood(name: string): Promise<Recognition> {
  return run(foodNameInstruction(name));
}
