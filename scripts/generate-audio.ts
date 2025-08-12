// Transforms src/lib/conversation.ts into chunks of audio
import { config } from "dotenv";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
  conversationSections,
  type ConversationSection,
} from "../src/lib/conversation";

// Load environment variables
config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AUDIO_OUTPUT_DIR = path.join(__dirname, "../public/audio/");
const TTS_MODEL = "tts-1";
const CONCURRENCY_LIMIT = 5;

// Voice options for different speakers
const NARRATOR_VOICE = "ash";
const HUMAN_VOICE = "echo";
const AI_VOICE_OPTIONS = [
  { number: 1, voice: "onyx", description: "low, gravely." },
  { number: 2, voice: "fable", description: "matter of fact, explanatory" },
  { number: 3, voice: "shimmer", description: "soft and steady" },
  { number: 4, voice: "nova", description: "lightly playful" },
];
const DEFAULT_AI_VOICE = "fable";

async function ensureOutputDirectory() {
  try {
    // Clear existing audio files
    try {
      const files = await fs.readdir(AUDIO_OUTPUT_DIR);
      const audioFiles = files.filter(
        (file) => file.endsWith(".wav") || file === "durations.json"
      );
      for (const file of audioFiles) {
        await fs.unlink(path.join(AUDIO_OUTPUT_DIR, file));
      }
      console.log(`Cleared ${audioFiles.length} existing audio files`);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(AUDIO_OUTPUT_DIR, { recursive: true });
      console.log(`Created output directory: ${AUDIO_OUTPUT_DIR}`);
    }
  } catch (error) {
    console.error("Error setting up output directory:", error);
    throw error;
  }
}

async function getWavDuration(filepath: string): Promise<number> {
  try {
    const stats = await fs.stat(filepath);
    const buffer = await fs.readFile(filepath);

    // Verify WAV file format
    if (
      buffer.subarray(0, 4).toString() !== "RIFF" ||
      buffer.subarray(8, 12).toString() !== "WAVE"
    ) {
      throw new Error("Not a valid WAV file");
    }

    // Read basic WAV header info (positions are fixed in standard WAV)
    const sampleRate = buffer.readUInt32LE(24);
    const numChannels = buffer.readUInt16LE(22);
    const bitsPerSample = buffer.readUInt16LE(34);

    // For OpenAI TTS WAV files, use simpler calculation based on file size
    // Subtract 44 bytes for standard WAV header
    const dataSize = stats.size - 44;
    const bytesPerSample = bitsPerSample / 8;
    const totalSamples = dataSize / (numChannels * bytesPerSample);
    const durationSeconds = totalSamples / sampleRate;

    return Math.round(durationSeconds * 1000);
  } catch (error) {
    console.error(`Error reading WAV duration for ${filepath}:`, error);
    return 0;
  }
}

async function limitConcurrency<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  limit: number
): Promise<void> {
  const results: Promise<any>[] = [];

  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchPromises = batch.map(processor);
    results.push(...batchPromises);

    // Wait for this batch to complete before starting the next
    await Promise.all(batchPromises);
  }
}

async function selectAIVoice(content: string): Promise<string> {
  const voiceOptionsText = AI_VOICE_OPTIONS.map(
    (option) => `${option.number}. ${option.voice} - ${option.description}`
  ).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are helping select the most appropriate AI voice for the given content. You will be given several voice options, each with a number. Respond with ONLY the number of the most appropriate voice option.

Voice options:
${voiceOptionsText}

Consider the tone, mood, and content type when selecting the voice.`,
      },
      {
        role: "user",
        content: content,
      },
    ],
    max_tokens: 10,
    temperature: 0.3,
  });

  const selectedNumber = parseInt(response.choices[0].message.content!.trim());
  const selectedVoice = AI_VOICE_OPTIONS.find(
    (option) => option.number === selectedNumber
  );

  if (!selectedVoice) {
    console.warn(`Invalid voice selection: ${selectedNumber}, defaulting`);
    return DEFAULT_AI_VOICE;
  }

  console.log(
    `Selected voice: ${selectedVoice.voice} (${selectedVoice.description})`
  );
  return selectedVoice.voice;
}

function getVoiceForSpeaker(speaker: ConversationSection["speaker"]): string {
  switch (speaker) {
    case "Narrator":
      return NARRATOR_VOICE;
    case "Human":
      return HUMAN_VOICE;
    case "Artificial Mind":
      // This will be determined by GPT-4o
      return "";
    default:
      return DEFAULT_AI_VOICE;
  }
}

async function generateAudio(
  text: string,
  voice: string,
  filename: string
): Promise<void> {
  console.log(`Generating audio with voice "${voice}" for: ${filename}`);

  const mp3 = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: voice as any,
    input: text,
    // instructions: "", TODO: add instructions
    response_format: "wav",
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  const filepath = path.join(AUDIO_OUTPUT_DIR, filename);
  await fs.writeFile(filepath, buffer);

  console.log(`Audio saved: ${filepath}`);
}

async function processConversationSection(
  section: ConversationSection,
  index: number,
  durationMap: Record<number, number>
): Promise<void> {
  console.log(`\nProcessing section ${index}: ${section.speaker}`);
  console.log(`Content preview: ${section.content.substring(0, 100)}...`);

  try {
    let voice: string;

    if (section.speaker === "Artificial Mind") {
      // Ask GPT-4o to select the voice
      voice = await selectAIVoice(section.content);
    } else {
      // Use predefined voice for Narrator and Human
      voice = getVoiceForSpeaker(section.speaker);
    }

    const filename = `${index}.wav`;
    await generateAudio(section.content, voice, filename);

    // Capture duration after file is generated
    const filepath = path.join(AUDIO_OUTPUT_DIR, filename);
    const duration = await getWavDuration(filepath);
    durationMap[index] = duration;

    console.log(`✅ Section ${index} completed (${duration}ms)`);
  } catch (error) {
    console.error(`❌ Error processing section ${index}:`, error);
  }
}

async function main() {
  try {
    console.log("Starting audio generation script...");
    console.log(`AI Voice Options:`);
    AI_VOICE_OPTIONS.forEach((option) => {
      console.log(
        `  ${option.number}. ${option.voice} - ${option.description}`
      );
    });
    console.log(`Narrator Voice: ${NARRATOR_VOICE}`);
    console.log(`Human Voice: ${HUMAN_VOICE}`);
    console.log(`Concurrency Limit: ${CONCURRENCY_LIMIT}`);

    // Ensure output directory exists
    await ensureOutputDirectory();

    console.log(
      `\nProcessing ${conversationSections.length} conversation sections with ${CONCURRENCY_LIMIT} concurrent requests`
    );

    // Duration mapping to store results
    const durationMap: Record<number, number> = {};

    // Create array of section indices for concurrent processing
    const sectionIndices = Array.from(
      { length: conversationSections.length },
      (_, i) => i
    );

    // Process sections concurrently with limit
    await limitConcurrency(
      sectionIndices,
      async (index) => {
        await processConversationSection(
          conversationSections[index],
          index,
          durationMap
        );
      },
      CONCURRENCY_LIMIT
    );

    // Save duration mapping to JSON file
    const durationMapPath = path.join(AUDIO_OUTPUT_DIR, "durations.json");
    await fs.writeFile(durationMapPath, JSON.stringify(durationMap, null, 2));

    console.log("\n✅ Audio generation completed!");
    console.log(`Audio files saved in: ${AUDIO_OUTPUT_DIR}`);
    console.log(`Duration mapping saved to: ${durationMapPath}`);
    console.log("\nDuration Summary:");
    Object.entries(durationMap).forEach(([index, duration]) => {
      console.log(
        `  Section ${index}: ${duration}ms (${(duration / 1000).toFixed(1)}s)`
      );
    });
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️  Script interrupted by user");
  process.exit(0);
});

// Run the script
main();
