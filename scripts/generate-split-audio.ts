// Generate audio BUT we allow the AI to split it into different voices.
// The output looks the same, since we stitch the wavs back together
import { config } from "dotenv";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

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

const AUDIO_OUTPUT_DIR = path.join(__dirname, "../public/split-audio/");
const TEMP_DIR = path.join(AUDIO_OUTPUT_DIR, "temp/");
const TTS_MODEL = "tts-1";
const CONCURRENCY_LIMIT = 8;

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
      const items = await fs.readdir(AUDIO_OUTPUT_DIR);
      let clearedCount = 0;

      for (const item of items) {
        const itemPath = path.join(AUDIO_OUTPUT_DIR, item);
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          // Remove subdirectory and all its contents
          await fs.rm(itemPath, { recursive: true, force: true });
          clearedCount++;
        } else if (item.endsWith(".wav") || item === "durations.json") {
          // Remove audio files in root
          await fs.unlink(itemPath);
          clearedCount++;
        }
      }
      console.log(`Cleared ${clearedCount} existing audio files/directories`);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(AUDIO_OUTPUT_DIR, { recursive: true });
      console.log(`Created output directory: ${AUDIO_OUTPUT_DIR}`);
    }

    // Create temp directory for intermediate files
    await fs.mkdir(TEMP_DIR, { recursive: true });
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

// Response type
interface VoiceChunksResponse {
  chunks: VoiceChunk[];
}

interface VoiceChunk {
  text: string;
  voice: number;
}

async function selectAIVoice(content: string): Promise<VoiceChunk[]> {
  const voiceOptionsText = AI_VOICE_OPTIONS.map(
    (option) => `${option.number}. ${option.voice} - ${option.description}`
  ).join("\n");

  const response = await openai.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content: `You are helping break up content into chunks with different AI voices. You will be given several voice options, each with a number. 

Voice options:
${voiceOptionsText}

You can choose to:
1. Use the same voice for all text (single chunk)
2. Split the text into multiple chunks with different voices for variety or emphasis
3. Change voices based on content, tone, or dramatic effect

Make sure all the original text is included across all chunks.`,
      },
      {
        role: "user",
        content: content,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "voice_chunks",
        schema: {
          type: "object",
          properties: {
            chunks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description: "The text chunk to be spoken",
                  },
                  voice: {
                    type: "integer",
                    minimum: 1,
                    maximum: 4,
                    description:
                      "The voice number (1-4) that should speak this chunk",
                  },
                },
                required: ["text", "voice"],
                additionalProperties: false,
              },
            },
          },
          required: ["chunks"],
          additionalProperties: false,
        },
        strict: true,
      },
    },
    max_tokens: 1000,
    temperature: 0.3,
  });

  try {
    const parsed = response.choices[0].message.parsed;

    if (!parsed) {
      throw new Error("Failed to parse AI response - parsed result is null");
    }

    const chunks: VoiceChunk[] = (parsed as VoiceChunksResponse).chunks;

    console.log(`AI selected ${chunks.length} voice chunks`);
    chunks.forEach((chunk, i) => {
      const voiceOption = AI_VOICE_OPTIONS.find(
        (opt) => opt.number === chunk.voice
      );
      console.log(
        `  Chunk ${i}: ${voiceOption?.voice} - "${chunk.text.substring(
          0,
          50
        )}..."`
      );
    });

    return chunks;
  } catch (error) {
    console.warn(
      "Failed to parse AI voice selection, using single default voice:",
      error
    );
    return [{ text: content, voice: 2 }]; // Default to fable voice
  }
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
  filename: string,
  outputDir: string = TEMP_DIR
): Promise<void> {
  console.log(`Generating audio with voice "${voice}" for: ${filename}`);

  const mp3 = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: voice as any,
    input: text,
    response_format: "wav",
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, buffer);

  console.log(`Audio saved: ${filepath}`);
}

async function stitchAudioFiles(
  filePaths: string[],
  outputPath: string
): Promise<void> {
  if (filePaths.length === 0) {
    throw new Error("No files to stitch");
  }

  if (filePaths.length === 1) {
    // Just copy the single file
    await fs.copyFile(filePaths[0], outputPath);
    return;
  }

  try {
    // Create a temporary file list for FFmpeg
    const fileListPath = path.join(TEMP_DIR, `filelist_${Date.now()}.txt`);
    const fileListContent = filePaths
      .map((fp) => `file '${path.resolve(fp)}'`)
      .join("\n");

    await fs.writeFile(fileListPath, fileListContent);

    // Use FFmpeg to concatenate the files
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputPath}"`;

    console.log(
      `Stitching ${filePaths.length} files into: ${path.basename(outputPath)}`
    );
    execSync(ffmpegCommand, { stdio: "pipe" });

    // Clean up the file list
    await fs.unlink(fileListPath);

    console.log(`✅ Successfully stitched audio: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`❌ Error stitching audio files:`, error);
    throw error;
  }
}

interface SectionAudioFiles {
  sectionIndex: number;
  filePaths: string[];
  totalDuration: number;
}

async function processConversationSection(
  section: ConversationSection,
  index: number
): Promise<SectionAudioFiles> {
  console.log(`\nProcessing section ${index}: ${section.speaker}`);
  console.log(`Content preview: ${section.content.substring(0, 100)}...`);

  const filePaths: string[] = [];
  let totalDuration = 0;

  try {
    if (section.speaker === "Artificial Mind") {
      // Ask GPT-4o to select voices and split content
      const voiceChunks = await selectAIVoice(section.content);

      for (let chunkIndex = 0; chunkIndex < voiceChunks.length; chunkIndex++) {
        const chunk = voiceChunks[chunkIndex];
        const voiceOption = AI_VOICE_OPTIONS.find(
          (opt) => opt.number === chunk.voice
        );
        const voice = voiceOption?.voice || DEFAULT_AI_VOICE;

        const filename = `section_${index}_chunk_${chunkIndex}.wav`;
        await generateAudio(chunk.text, voice, filename);

        // Capture duration for this chunk
        const filepath = path.join(TEMP_DIR, filename);
        const duration = await getWavDuration(filepath);
        totalDuration += duration;
        filePaths.push(filepath);

        console.log(
          `  ✅ Chunk ${chunkIndex} completed (${duration}ms) with voice ${voice}`
        );
      }

      console.log(
        `✅ Section ${index} completed with ${voiceChunks.length} chunks (${totalDuration}ms total)`
      );
    } else {
      // Use predefined voice for Narrator and Human (single chunk)
      const voice = getVoiceForSpeaker(section.speaker);
      const filename = `section_${index}_single.wav`;
      await generateAudio(section.content, voice, filename);

      // Capture duration
      const filepath = path.join(TEMP_DIR, filename);
      const duration = await getWavDuration(filepath);
      totalDuration = duration;
      filePaths.push(filepath);

      console.log(
        `✅ Section ${index} completed (${duration}ms) with voice ${voice}`
      );
    }

    return { sectionIndex: index, filePaths, totalDuration };
  } catch (error) {
    console.error(`❌ Error processing section ${index}:`, error);
    throw error;
  }
}

async function cleanupTempFiles(): Promise<void> {
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    console.log("✅ Cleaned up temporary files");
  } catch (error) {
    console.warn("⚠️  Could not clean up temporary files:", error);
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
    const durationMap: Record<string, number> = {};
    const sectionResults: SectionAudioFiles[] = [];

    // Create array of section indices for concurrent processing
    const sectionIndices = Array.from(
      { length: conversationSections.length },
      (_, i) => i
    );

    // Process sections concurrently with limit
    await limitConcurrency(
      sectionIndices,
      async (index) => {
        const result = await processConversationSection(
          conversationSections[index],
          index
        );
        sectionResults[index] = result;
        durationMap[index.toString()] = result.totalDuration;
      },
      CONCURRENCY_LIMIT
    );

    // Sort results by section index to maintain order
    sectionResults.sort((a, b) => a.sectionIndex - b.sectionIndex);

    console.log("\n🔗 Stitching sections into final audio files...");

    // Stitch each section's chunks together and create final numbered files
    for (let i = 0; i < sectionResults.length; i++) {
      const section = sectionResults[i];
      const outputFilename = `${i}.wav`;
      const outputPath = path.join(AUDIO_OUTPUT_DIR, outputFilename);

      await stitchAudioFiles(section.filePaths, outputPath);

      const finalDuration = await getWavDuration(outputPath);
      console.log(
        `  ${outputFilename}: ${finalDuration}ms (${(
          finalDuration / 1000
        ).toFixed(1)}s)`
      );
    }

    // Save duration mapping to JSON file
    const durationMapPath = path.join(AUDIO_OUTPUT_DIR, "durations.json");
    await fs.writeFile(durationMapPath, JSON.stringify(durationMap, null, 2));

    // Clean up temporary files
    await cleanupTempFiles();

    console.log("\n✅ Audio generation and stitching completed!");
    console.log(`Audio files saved in: ${AUDIO_OUTPUT_DIR}`);
    console.log(
      `Final files: ${sectionResults.map((_, i) => `${i}.wav`).join(", ")}`
    );
    console.log(`Duration mapping saved to: ${durationMapPath}`);
    console.log("\nDuration Summary:");
    Object.entries(durationMap).forEach(([index, duration]) => {
      console.log(
        `  ${index}.wav: ${duration}ms (${(duration / 1000).toFixed(1)}s)`
      );
    });
  } catch (error) {
    console.error("❌ Script failed:", error);

    // Try to clean up temp files even on failure
    try {
      await cleanupTempFiles();
    } catch {}

    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⏹️  Script interrupted by user");
  try {
    await cleanupTempFiles();
  } catch {}
  process.exit(0);
});

// Run the script
main();
