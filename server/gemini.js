import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import { SYSTEM_INSTRUCTIONS } from './constants.js';

const PROMPT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      prompt: { type: 'string' },
    },
    required: ['name', 'prompt'],
  },
};

function pick(obj, ...keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] != null) return obj[key];
  }
  return undefined;
}

export function parsePromptList(raw) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  const list = Array.isArray(parsed) ? parsed : parsed.items || parsed.prompts;
  if (!Array.isArray(list)) throw new Error('Gemini did not return a JSON array of prompts');
  return list
    .map((item) => ({
      name: String(item.name || '').trim(),
      prompt: String(item.prompt || '').trim(),
    }))
    .filter((item) => item.name && item.prompt);
}

export function extractOutputText(interaction) {
  const direct = pick(interaction, 'output_text', 'outputText');
  if (direct) return direct;
  const steps = pick(interaction, 'steps') || [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    const contents = pick(step, 'content') || [];
    for (let j = contents.length - 1; j >= 0; j--) {
      const part = contents[j];
      const text = pick(part, 'text');
      if (text) return text;
    }
  }
  return '';
}

export function extractImage(interaction) {
  const direct = pick(interaction, 'output_image', 'outputImage');
  if (direct && (pick(direct, 'data') || pick(direct, 'imageBytes'))) {
    return {
      mimeType: pick(direct, 'mime_type', 'mimeType') || 'image/png',
      data: pick(direct, 'data', 'imageBytes'),
    };
  }
  const steps = pick(interaction, 'steps') || [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    const contents = pick(step, 'content') || [];
    for (let j = contents.length - 1; j >= 0; j--) {
      const part = contents[j];
      const type = pick(part, 'type');
      const inline = pick(part, 'inline_data', 'inlineData');
      if (type === 'image' || inline) {
        const data = pick(part, 'data') || pick(inline, 'data');
        if (data) {
          return {
            mimeType: pick(part, 'mime_type', 'mimeType') || pick(inline, 'mimeType') || 'image/png',
            data,
          };
        }
      }
    }
  }
  return null;
}

function decodeImageBuffer(image) {
  if (!image?.data) throw new Error('No image data in Gemini response');
  if (Buffer.isBuffer(image.data)) return { buffer: image.data, mimeType: image.mimeType };
  return { buffer: Buffer.from(image.data, 'base64'), mimeType: image.mimeType };
}

export function createGemini(options = {}) {
  const apiKey = options.apiKey ?? config.geminiApiKey;
  const textModel = options.textModel ?? config.textModel;
  const imageModel = options.imageModel ?? config.imageModel;
  const client = options.client || (apiKey ? new GoogleGenAI({ apiKey }) : null);

  async function createInteraction(body) {
    if (!client?.interactions?.create) {
      throw new Error('Gemini client is not configured (missing GEMINI_API_KEY)');
    }
    return client.interactions.create(body);
  }

  return {
    async uploadBook(filePath) {
      if (!client?.files?.upload) {
        throw new Error('Gemini client is not configured (missing GEMINI_API_KEY)');
      }
      const file = await client.files.upload({
        file: filePath,
        config: { mimeType: 'text/plain', displayName: 'book.txt' },
      });
      return {
        uri: pick(file, 'uri') || file,
        name: pick(file, 'name'),
      };
    },

    async startBookChat(fileUri) {
      const interaction = await createInteraction({
        model: textModel,
        input: [
          {
            type: 'text',
            text: "Here's a book, to illustrate using Nano Banana. Don't say anything for now, instructions will follow.",
          },
          { type: 'document', uri: fileUri },
        ],
      });
      return pick(interaction, 'id');
    },

    async defineStyle(previousId, customStyle) {
      const trimmed = (customStyle || '').trim();
      if (trimmed) {
        const interaction = await createInteraction({
          model: textModel,
          input: `The art style will be:"${trimmed}". Keep that in mind when generating future prompts. Keep quiet for now, instructions will follow.`,
          previous_interaction_id: previousId,
        });
        return { id: pick(interaction, 'id'), style: trimmed };
      }
      const interaction = await createInteraction({
        model: textModel,
        input:
          'Can you define a art style that would fit the story but with a twist? Just give us the prompt for the art style that will added to the future prompts.',
        previous_interaction_id: previousId,
      });
      const style = extractOutputText(interaction).trim();
      if (!style) throw new Error('Gemini returned an empty style');
      return { id: pick(interaction, 'id'), style };
    },

    async generateCharacters(previousId) {
      const interaction = await createInteraction({
        model: textModel,
        input:
          'Can you describe the main characters (only the adults) and prepare a prompt describing them with as much details as possible (use the descriptions from the book) so Nano Banana can generate images of them? Each prompt should be at least 50 words. Return at most 2 characters.',
        previous_interaction_id: previousId,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: PROMPT_SCHEMA,
        },
      });
      const list = parsePromptList(extractOutputText(interaction));
      if (!list.length) throw new Error('Gemini returned no adult characters');
      return { id: pick(interaction, 'id'), characters: list };
    },

    async generateChapters(previousId) {
      const interaction = await createInteraction({
        model: textModel,
        input:
          "Now, for each chapters of the book, give me a prompt to illustrate what happens in it. It should be a single image, not a multi-tiled page. Be very descriptive, especially of the characters. Be very descriptive and remember to tell their name and to reuse the character prompts if they appear in the images. Also list all characters who appear in it. Return at most 1 chapter.",
        previous_interaction_id: previousId,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: PROMPT_SCHEMA,
        },
      });
      const list = parsePromptList(extractOutputText(interaction));
      if (!list.length) throw new Error('Gemini returned no chapters');
      return { id: pick(interaction, 'id'), chapters: list };
    },

    async startImageChat(style) {
      const interaction = await createInteraction({
        model: imageModel,
        input: `You are going to generate portrait images to illustrate a book.
The style we want you to follow is: Follow this style: "${style}"
Also follow those rules: ${SYSTEM_INSTRUCTIONS}`,
      });
      return pick(interaction, 'id');
    },

    async generatePortrait(previousId, character) {
      const interaction = await createInteraction({
        model: imageModel,
        input: `Create an illustration for ${character.name} following this description: ${character.prompt}`,
        previous_interaction_id: previousId,
      });
      const image = extractImage(interaction);
      if (!image) throw new Error(`No image generated for ${character.name}`);
      return { id: pick(interaction, 'id'), ...decodeImageBuffer(image) };
    },

    async startChapterImages(previousId) {
      const interaction = await createInteraction({
        model: imageModel,
        input:
          "Starting from now, we're going to illustrate the book's chapters. Don't forget to refer to your previous illustrations of the characters to keep the characters consistency, but feel free to change their position.",
        previous_interaction_id: previousId,
      });
      return pick(interaction, 'id');
    },

    async generateIllustration(previousId, chapter) {
      const interaction = await createInteraction({
        model: imageModel,
        input: `Create an illustration for ${chapter.name} using the previously generated characters following this description: ${chapter.prompt}`,
        previous_interaction_id: previousId,
      });
      const image = extractImage(interaction);
      if (!image) throw new Error(`No image generated for ${chapter.name}`);
      return { id: pick(interaction, 'id'), ...decodeImageBuffer(image) };
    },
  };
}

export async function ensureBookUploaded(gemini, project, bookFilePath) {
  if (project.gemini.fileUri && project.gemini.bookInteractionId) return;
  const uploaded = await gemini.uploadBook(bookFilePath);
  project.gemini.fileUri = uploaded.uri;
  project.gemini.fileName = uploaded.name || null;
  project.gemini.bookInteractionId = await gemini.startBookChat(uploaded.uri);
}

export { PROMPT_SCHEMA };
