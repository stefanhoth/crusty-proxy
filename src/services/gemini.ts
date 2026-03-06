import axios from "axios";
import type { GeminiKeysSchema } from "../types.js";
import type { z } from "zod";
import type { ImageContent } from "../types.js";

type GeminiKeys = z.infer<typeof GeminiKeysSchema>;

const IMAGE_MODEL = "gemini-2.5-flash-image";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiService {
  constructor(private keys: GeminiKeys) {}

  async generateImage(args: {
    prompt: string;
    aspect_ratio?: string;
    image_size?: string;
  }): Promise<{ text: string; images: ImageContent[] }> {
    const imageConfig: Record<string, string> = {};
    if (args.aspect_ratio) imageConfig.aspect_ratio = args.aspect_ratio;
    if (args.image_size) imageConfig.image_size = args.image_size;

    const res = await axios.post(
      `${BASE}/models/${IMAGE_MODEL}:generateContent`,
      {
        contents: [{ parts: [{ text: args.prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(Object.keys(imageConfig).length > 0 && { imageConfig }),
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

    if (images.length === 0) {
      throw new Error("Gemini returned no images");
    }

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
    const res = await axios.post(
      `${BASE}/models/${IMAGE_MODEL}:generateContent`,
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
