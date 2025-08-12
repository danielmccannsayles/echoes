// Transforms src/lib/conversation.ts into chunks of audio
import { config } from "dotenv";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

import {
  conversationSections,
  type ConversationSection,
} from "../src/lib/conversation";

// Load environment variables
config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AUDIO_OUTPUT_DIR = "./generated-audio";
const TTS_MODEL = "tts-1";

// Voice options for different speakers
const NARRATOR_VOICE = "ash";
const HUMAN_VOICE = "echo";
const AI_VOICE_OPTIONS = [
  { number: 1, voice: "echo", description: "boyish tone" },
  { number: 2, voice: "fable", description: "matter of fact, explanatory" },
  { number: 3, voice: "shimmer", description: "lightly playful" },
];
const DEFAULT_AI_VOICE = "fable";

async function ensureOutputDirectory() {
  try {
    await fs.access(AUDIO_OUTPUT_DIR);
  } catch {
    await fs.mkdir(AUDIO_OUTPUT_DIR, { recursive: true });
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
    response_format: "wav",
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  const filepath = path.join(AUDIO_OUTPUT_DIR, filename);
  await fs.writeFile(filepath, buffer);

  console.log(`Audio saved: ${filepath}`);
}

async function processConversationSection(
  section: ConversationSection,
  index: number
): Promise<void> {
  console.log(`\nProcessing section ${index}: ${section.speaker}`);
  console.log(`Content preview: ${section.content.substring(0, 100)}...`);

  try {
    let voice: string;

    if (section.speaker === "Artificial Mind") {
      // Ask GPT-4o to select the voice
      voice = await selectAIVoice(section.content);
      // Small delay after GPT call
      await new Promise((resolve) => setTimeout(resolve, 300));
    } else {
      // Use predefined voice for Narrator and Human
      voice = getVoiceForSpeaker(section.speaker);
    }

    const filename = `${index}.wav`;
    await generateAudio(section.content, voice, filename);

    // Add a small delay between TTS calls to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.error(`Error processing section ${index}:`, error);
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

    // Ensure output directory exists
    await ensureOutputDirectory();

    console.log(
      `\nProcessing ${conversationSections.length} conversation sections`
    );

    // Process each conversation section
    for (let i = 0; i < conversationSections.length; i++) {
      await processConversationSection(conversationSections[i], i);
    }

    console.log("\n✅ Audio generation completed!");
    console.log(`Audio files saved in: ${AUDIO_OUTPUT_DIR}`);
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
