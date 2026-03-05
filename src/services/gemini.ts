import axios from "axios";
import type { GeminiKeysSchema } from "../types.js";
import type { z } from "zod";
import type { ImageContent } from "../types.js";

type GeminiKeys = z.infer<typeof GeminiKeysSchema>;

const IMAGEN_MODEL = "imagen-3.0-generate-001";
const GEMINI_MODEL = "gemini-2.0-flash-exp";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiService {
  constructor(private keys: GeminiKeys) {}

  async generateImage(args: {
    prompt: string;
    aspect_ratio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
    number_of_images?: number;
  }): Promise<{ text: string; images: ImageContent[] }> {
    const res = await axios.post(
      `${BASE}/models/${IMAGEN_MODEL}:predict`,
      {
        instances: [{ prompt: args.prompt }],
        parameters: {
          aspectRatio: args.aspect_ratio ?? "1:1",
          sampleCount: Math.min(args.number_of_images ?? 1, 4),
        },
      },
      {
        params: { key: this.keys.api_key },
        headers: { "Content-Type": "application/json" },
      },
    );

    const predictions: Array<{ bytesBase64Encoded: string; mimeType: string }> =
      res.data.predictions ?? [];

    if (predictions.length === 0) {
      throw new Error("Imagen returned no images");
    }

    const images: ImageContent[] = predictions.map((p) => ({
      type: "image" as const,
      data: p.bytesBase64Encoded,
      mimeType: p.mimeType ?? "image/png",
    }));

    return {
      text: `Generated ${images.length} image(s) for prompt: "${args.prompt}"`,
      images,
    };
  }

  async editImage(args: {
    image_base64: string;
    image_mime_type?: string;
    prompt: string;
  }): Promise<{ text: string; images: ImageContent[] }> {
    // Use Gemini 2.0 Flash with image input + image output
    const res = await axios.post(
      `${BASE}/models/${GEMINI_MODEL}:generateContent`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                inline_data: {
                  mime_type: args.image_mime_type ?? "image/png",
                  data: args.image_base64,
                },
              },
              { text: args.prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["image", "text"],
        },
      },
      {
        params: { key: this.keys.api_key },
        headers: { "Content-Type": "application/json" },
      },
    );

    const parts: Array<Record<string, unknown>> =
      res.data.candidates?.[0]?.content?.parts ?? [];

    const images: ImageContent[] = parts
      .filter((p) => p.inline_data)
      .map((p) => {
        const d = p.inline_data as { mime_type: string; data: string };
        return { type: "image" as const, data: d.data, mimeType: d.mime_type };
      });

    const textPart = parts.find((p) => typeof p.text === "string");
    const text = typeof textPart?.text === "string" ? textPart.text : "Image edited.";

    if (images.length === 0) {
      throw new Error("Gemini returned no image output. The model may not support image editing for this input.");
    }

    return { text, images };
  }
}
