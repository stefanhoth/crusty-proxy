---
name: gemini-image
description: Generate and edit images via the crusty-proxy MCP server. Uses Google Imagen 3 for generation and Gemini 2.0 Flash for editing. Returns images directly as MCP image content.
homepage: https://ai.google.dev/
metadata:
  {
    "openclaw":
      {
        "emoji": "🖼️",
        "requires": { "bins": ["mcporter"] },
        "mcpServer": "crusty-proxy",
      },
  }
---

# Gemini Image

Generate and edit images via MCP tools exposed by crusty-proxy.

- **Generation:** Google Imagen 3 (`imagen-3.0-generate-001`) — high-quality photorealistic and artistic images
- **Editing:** Gemini 2.0 Flash (`gemini-2.0-flash-exp`) — transform or modify an existing image with a prompt

Image results are returned as MCP `image` content (base64 PNG/JPEG inline), not as file paths.

**Note:** Image generation can take 10–30 seconds. Do not retry immediately on slow responses.

## Tools

### `gemini.generate_image`

Generate one or more images from a text prompt using Imagen 3.

Parameters:
- `prompt` (required) — detailed image description. More detail = better results.
- `aspect_ratio` — `"1:1"` (default) · `"16:9"` · `"9:16"` · `"4:3"` · `"3:4"`
- `number_of_images` — 1–4, default 1

Returns: text summary + one or more `image` content blocks (base64 encoded).

Prompt tips:
- Include style: `"photorealistic"`, `"oil painting"`, `"watercolor"`, `"3D render"`, `"flat illustration"`
- Include lighting: `"golden hour"`, `"studio lighting"`, `"dramatic shadows"`
- Include composition: `"close-up"`, `"wide angle"`, `"aerial view"`, `"portrait"`

Example — product photo:
```json
{
  "prompt": "A sleek matte black coffee mug on a white marble surface, studio lighting, photorealistic, top-down view",
  "aspect_ratio": "1:1"
}
```

Example — landscape for a blog header:
```json
{
  "prompt": "Swiss Alps at golden hour, snow-capped peaks, dramatic clouds, wide angle, photorealistic",
  "aspect_ratio": "16:9"
}
```

Example — multiple variations:
```json
{
  "prompt": "Minimalist logo concept for a tech startup, flat design, blue and white",
  "number_of_images": 4,
  "aspect_ratio": "1:1"
}
```

---

### `gemini.edit_image`

Edit or transform an existing image using a text instruction. Input must be a base64-encoded image.

Parameters:
- `image_base64` (required) — base64-encoded image data (without `data:` prefix)
- `image_mime_type` — `"image/png"` (default) · `"image/jpeg"` · `"image/webp"`
- `prompt` (required) — edit instruction

Returns: text description + edited `image` content block.

Edit prompt examples:
- `"Change the background to a sunset beach scene"`
- `"Make the image look like a watercolor painting"`
- `"Add falling snow to the scene"`
- `"Remove the object in the top right corner"`
- `"Convert to black and white with a red accent color"`

Example:
```json
{
  "image_base64": "<base64 string here>",
  "image_mime_type": "image/png",
  "prompt": "Make the sky more dramatic with storm clouds"
}
```

**Note:** If editing returns an error about unsupported input, the image format or size may be incompatible. Try converting to PNG and resizing to under 4MB before sending.

## Decision guide

- User asks to create / generate / draw an image → `gemini.generate_image`
- User provides an image and wants it modified → `gemini.edit_image`
- User wants multiple options → `gemini.generate_image` with `number_of_images: 4`
- For banner/header images → `aspect_ratio: "16:9"`
- For phone wallpapers / stories → `aspect_ratio: "9:16"`
- For profile pictures / thumbnails → `aspect_ratio: "1:1"`
