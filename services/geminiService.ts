import { GoogleGenAI, Type } from "@google/genai";
import { PlatformContent } from "../types";
import {
  loadGlobalPromptConfig,
  loadDomainPromptConfig,
  getDefaultPlatformPromptConfig,
} from "./promptConfig";

const createClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 1200;
const GEMINI_MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractHttpStatus = (error: unknown): number | null => {
  if (!error || typeof error !== "object") return null;
  const maybe = error as { status?: number; message?: string };
  if (typeof maybe.status === "number") return maybe.status;
  if (typeof maybe.message !== "string") return null;
  const matched = maybe.message.match(/"code"\s*:\s*(\d{3})/);
  return matched ? Number(matched[1]) : null;
};

const isRetryableGeminiError = (error: unknown): boolean => {
  const status = extractHttpStatus(error);
  return status !== null && RETRYABLE_HTTP_STATUS.has(status);
};

const runWithRetry = async <T>(operation: () => Promise<T>, label: string): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = extractHttpStatus(error);
      if (!isRetryableGeminiError(error) || attempt === DEFAULT_MAX_RETRIES) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 300);
      const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1) + jitter;
      console.warn(`${label} failed (attempt ${attempt}/${DEFAULT_MAX_RETRIES}), retrying in ${delay}ms...`, error);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed after retries`);
};

const generateWithModelFallback = async (
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">,
  label: string
) => {
  let lastError: unknown = null;
  for (const model of GEMINI_MODEL_CANDIDATES) {
    try {
      return await runWithRetry(() => ai.models.generateContent({ model, ...params }), `${label} [${model}]`);
    } catch (error) {
      lastError = error;
      const status = extractHttpStatus(error);
      if (status !== 503 && status !== 429) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed for all model candidates`);
};

// Helper to convert File to Base64 for inlineData
const fileToPart = async (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        const base64Data = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("File reading error"));
    reader.readAsDataURL(file);
  });
};

/** Video input: either in-memory File or a public URL (e.g. Supabase Storage). Gemini supports fileData.fileUri for HTTPS URLs. */
export type VideoInput = { file?: File; videoUrl?: string };

async function buildVideoPart(input: VideoInput): Promise<
  | { inlineData: { data: string; mimeType: string } }
  | { fileData: { fileUri: string; mimeType?: string } }
> {
  if (input.file) return fileToPart(input.file);
  if (input.videoUrl) return { fileData: { fileUri: input.videoUrl, mimeType: 'video/mp4' } };
  throw new Error('Either file or videoUrl must be provided for video input.');
}

/** Default system prompt template for video-to-social generation. Exported for PromptsPage Global Defaults. */
export const getDefaultSystemPrompt = (businessUnit: string, language: string): string =>
  `You are a specialized social media manager for a South African ${businessUnit} agency. 
  Your task is to deeply analyze the provided video (visuals, audio, and events) and repurpose it into optimized posts for multiple platforms.
  
  Tone Guidelines:
  - LinkedIn: Professional, authoritative, insightful.
  - Facebook: Community-focused, informative, engaging.
  - Twitter (X): Concise, punchy, news-focused.
  - Instagram: Visual storytelling, emotive, emoji-friendly.
  - TikTok: Script-like, hook-heavy, trend-aware.
  - YouTube: Clear title and description; script or description can include hooks, key points, and CTA. Suited for video.
  
  Language: ${language} (South African English spelling and slight local phrasing where appropriate).
  
  Instructions:
  1. Analyze the video content, identifying key topics, spoken words, and visual elements.
  2. If 'videoContext' is provided, use it to frame the analysis.
  3. Generate specific, high-quality copy for each platform based on the video's actual content.
  4. You MUST output exactly one object per platform in the list of platforms requested by the user. Do not omit any platform from that list.
  `;

const PLATFORM_ORDER = ['linkedin', 'instagram', 'youtube', 'twitter', 'tiktok', 'facebook'] as const;

/** Effective prompt config for a platform: Global Default merged with Domain Specific overrides for the BU. */
function getEffectivePromptConfig(buType: string, platformId: string) {
  const global = loadGlobalPromptConfig();
  const domain = loadDomainPromptConfig(buType);
  const defaultC = getDefaultPlatformPromptConfig(platformId);
  const g = global[platformId] ?? defaultC;
  const d = domain[platformId];
  return {
    ...g,
    ...d,
    platform: platformId,
    titlePrompt: d?.titlePrompt ?? g.titlePrompt ?? defaultC.titlePrompt,
    bodyPrompt: d?.bodyPrompt ?? g.bodyPrompt ?? defaultC.bodyPrompt,
    titleMaxLength: g.titleMaxLength ?? defaultC.titleMaxLength,
    bodyMaxLength: g.bodyMaxLength ?? defaultC.bodyMaxLength,
    hashtagAlwaysInclude: (d?.hashtagAlwaysInclude?.length ? d.hashtagAlwaysInclude : g.hashtagAlwaysInclude) ?? [],
    hashtagPool: (d?.hashtagPool?.length ? d.hashtagPool : g.hashtagPool) ?? [],
    hashtagTotalMax: g.hashtagTotalMax ?? defaultC.hashtagTotalMax,
  };
}

/** Build per-platform instruction snippet for system prompt from effective config. */
function buildPerPlatformInstructions(buType: string, platformIds: string[]): string {
  const parts: string[] = [];
  platformIds.forEach((platformId) => {
    const c = getEffectivePromptConfig(buType, platformId);
    const lines: string[] = [`**${platformId}**:`];
    if (c.titlePrompt) lines.push(`Title: ${c.titlePrompt}. Max length: ${c.titleMaxLength ?? 100} characters. Tone: ${c.titleTone ?? 'professional'}.`);
    if (c.bodyPrompt) lines.push(`Body: ${c.bodyPrompt}. Max length: ${c.bodyMaxLength ?? 2200} characters. Tone: ${c.bodyTone ?? 'professional'}.`);
    if (c.bodyIncludeCta && c.bodyCtaOptions) lines.push(`Include CTA: ${c.bodyCtaOptions}.`);
    const always = c.hashtagAlwaysInclude?.length ? c.hashtagAlwaysInclude.join(', ') : '';
    const pool = c.hashtagPool?.length ? c.hashtagPool.join(', ') : '';
    if (always || pool) {
      const hashtagRules: string[] = [];
      if (always) hashtagRules.push(`Always include: ${always}`);
      if (pool) hashtagRules.push(`Prefer from pool: ${pool}`);
      lines.push(`Hashtags: ${hashtagRules.join('; ')}. Total max ${c.hashtagTotalMax ?? 8} hashtags per post.`);
    }
    parts.push(lines.join(' '));
  });
  return parts.length ? '\n\nPer-platform instructions (follow for each platform):\n' + parts.join('\n') : '';
}

export const generateSocialMatrix = async (
  videoFile: File,
  videoContext: string,
  buId: string,
  buLabel: string,
  language: string,
  enabledPlatformIds: string[]
): Promise<PlatformContent[]> => {
  const ai = createClient();
  if (!ai) throw new Error("AI Client not initialized");

  const platformsToGenerate = enabledPlatformIds.length > 0
    ? enabledPlatformIds.filter((id) => PLATFORM_ORDER.includes(id as any))
    : [...PLATFORM_ORDER];
  const platformList = platformsToGenerate.join(', ');

  const baseSystemPrompt = getDefaultSystemPrompt(buLabel, language);
  const perPlatform = buildPerPlatformInstructions(buId, platformsToGenerate);
  const systemPrompt = baseSystemPrompt + perPlatform;

  try {
    // Convert video file to inline data
    const videoPart = await fileToPart(videoFile);

    const response = await generateWithModelFallback(
      ai,
      {
          contents: {
            parts: [
              videoPart,
              {
                text: `Analyze this video. Context provided by user: "${videoContext || 'No additional context provided'}". Generate a social media content matrix. You MUST output exactly one content object for each of these platforms (do not skip any): ${platformList}. Include title, content, and hashtags for every platform listed. Follow the per-platform instructions in the system prompt for tone, length limits, and hashtag rules.`
              }
            ]
          },
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: {
                    type: Type.STRING,
                    enum: ["linkedin", "facebook", "twitter", "instagram", "tiktok", "youtube"],
                  },
                  title: {
                    type: Type.STRING,
                    description: "A catchy headline or video title",
                  },
                  content: {
                    type: Type.STRING,
                    description: "The main post body or video script description",
                  },
                  hashtags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "3-5 relevant hashtags",
                  },
                },
                required: ["platform", "title", "content", "hashtags"],
              },
            },
          },
        },
      "Gemini content generation"
    );

    const text = response.text;
    if (!text) return [];

    const rawData = JSON.parse(text);
    const allowedSet = new Set(platformsToGenerate);
    const filtered = Array.isArray(rawData) ? rawData.filter((item: any) => item?.platform && allowedSet.has(item.platform)) : [];
    return filtered.map((item: any) => {
      const config = getEffectivePromptConfig(buId, item.platform);
      const alwaysInclude = config.hashtagAlwaysInclude ?? [];
      const totalMax = config.hashtagTotalMax ?? 8;
      const existing = Array.isArray(item.hashtags) ? item.hashtags : [];
      const merged = [...alwaysInclude];
      existing.forEach((tag: string) => {
        const t = tag.startsWith('#') ? tag : `#${tag}`;
        if (!merged.includes(t) && merged.length < totalMax) merged.push(t);
      });
      return {
        ...item,
        hashtags: merged.slice(0, totalMax),
        status: 'draft',
        selected: true,
      };
    });

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    const status = extractHttpStatus(error);
    const isServiceBusy = status === 503 || status === 429;
    // Return fallback data in case of error
    return [
      {
        platform: 'linkedin',
        title: 'Error generating content',
        content: isServiceBusy
          ? "AI service is temporarily busy. Please retry in 1-2 minutes."
          : `Could not analyze video. Error: ${(error as Error).message}. Ensure the video is less than 20MB for browser-based processing, or check your API key.`,
        hashtags: ['#error'],
        status: 'draft',
        selected: false
      }
    ];
  }
};

/** Regenerate caption for a single platform. Video can be provided as File or videoUrl (e.g. Supabase Storage). Optional userPrompt guides the regeneration. */
export const regenerateSinglePlatform = async (
  videoInput: VideoInput,
  videoContext: string,
  buId: string,
  buLabel: string,
  language: string,
  platformId: string,
  userPrompt?: string
): Promise<PlatformContent> => {
  const ai = createClient();
  if (!ai) throw new Error("AI Client not initialized");

  const baseSystemPrompt = getDefaultSystemPrompt(buLabel, language);
  const perPlatform = buildPerPlatformInstructions(buId, [platformId]);
  const systemPrompt = baseSystemPrompt + perPlatform;

  const userInstruction = userPrompt?.trim()
    ? `User instruction for this platform: "${userPrompt.trim()}". Follow it when regenerating.`
    : "Regenerate caption for this platform only.";

  try {
    const videoPart = await buildVideoPart(videoInput);

    const response = await generateWithModelFallback(
      ai,
      {
          contents: {
            parts: [
              videoPart,
              {
                text: `Analyze this video. Context: "${videoContext || 'No additional context'}". ${userInstruction} Generate exactly one content object for the platform: ${platformId}. Include title, content, and hashtags. Follow the per-platform instructions in the system prompt.`
              }
            ]
          },
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: {
                    type: Type.STRING,
                    enum: ["linkedin", "facebook", "twitter", "instagram", "tiktok", "youtube"],
                  },
                  title: { type: Type.STRING, description: "Headline or video title" },
                  content: { type: Type.STRING, description: "Main post body or description" },
                  hashtags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Relevant hashtags",
                  },
                },
                required: ["platform", "title", "content", "hashtags"],
              },
            },
          },
        },
      "Gemini single platform regeneration"
    );

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    const rawData = JSON.parse(text);
    const item = Array.isArray(rawData) && rawData.length > 0 ? rawData[0] : rawData;
    if (!item || item.platform !== platformId) throw new Error("Invalid or missing platform in response");

    const config = getEffectivePromptConfig(buId, platformId);
    const alwaysInclude = config.hashtagAlwaysInclude ?? [];
    const totalMax = config.hashtagTotalMax ?? 8;
    const existing = Array.isArray(item.hashtags) ? item.hashtags : [];
    const merged = [...alwaysInclude];
    existing.forEach((tag: string) => {
      const t = tag.startsWith('#') ? tag : `#${tag}`;
      if (!merged.includes(t) && merged.length < totalMax) merged.push(t);
    });

    return {
      ...item,
      platform: platformId as PlatformContent["platform"],
      hashtags: merged.slice(0, totalMax),
      status: 'draft',
      selected: true,
    };
  } catch (error) {
    console.error("Gemini Regenerate Single Platform Error:", error);
    throw error;
  }
};
