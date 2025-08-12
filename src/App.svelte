<script lang="ts">
  import { conversationSections } from "./lib/conversation";
  import { onMount, onDestroy } from "svelte";
  import PlayIcon from "./lib/icons/PlayIcon.svelte";
  import PauseIcon from "./lib/icons/PauseIcon.svelte";
  import UpIcon from "./lib/icons/UpIcon.svelte";
  import DownIcon from "./lib/icons/DownIcon.svelte";
  import SpeakerIcon from "./lib/icons/SpeakerIcon.svelte";
  import SpeakerMutedIcon from "./lib/icons/SpeakerMutedIcon.svelte";

  let currentSectionIndex: number = 0;
  let isAutoScrolling: boolean = false;
  let timeRemaining: number = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let sectionElements: HTMLDivElement[] = [];
  let voiceEnabled: boolean = true;
  let audioDurations: Record<number, number> = {};
  let audioPlayer: HTMLAudioElement | null = null;
  let progressPercent: number = 0;

  onMount(async () => {
    // Load audio durations from generated file
    try {
      const response = await fetch("/audio/durations.json");
      if (response.ok) {
        audioDurations = await response.json();
        console.log("Loaded audio durations:", audioDurations);
      } else {
        console.warn("Could not load durations.json, using fallback durations");
      }
    } catch (error) {
      console.warn("Error loading audio durations:", error);
    }

    // Initialize single audio player
    audioPlayer = new Audio();

    if (isAutoScrolling) {
      startTimer();
    }
  });

  onDestroy(() => {
    if (timer) {
      clearInterval(timer);
    }
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }
  });

  function startTimer(): void {
    if (currentSectionIndex >= conversationSections.length) return;

    // Use audio duration if available, otherwise fall back to manual duration
    const audioDuration = audioDurations[currentSectionIndex];
    timeRemaining =
      audioDuration || conversationSections[currentSectionIndex].durationMs;

    // Start audio playback if voice is enabled
    if (voiceEnabled) {
      playAudioForSection(currentSectionIndex);
    }

    timer = setInterval(() => {
      timeRemaining -= 100;

      if (timeRemaining <= 0) {
        nextSection();
      }
    }, 100);
  }

  function stopTimer(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (audioPlayer) {
      audioPlayer.pause();
    }
  }

  function nextSection(): void {
    if (currentSectionIndex < conversationSections.length - 1) {
      currentSectionIndex++;
      scrollToSection(currentSectionIndex);

      if (isAutoScrolling) {
        stopTimer();
        startTimer();
      }
    } else {
      isAutoScrolling = false;
      stopTimer();
    }
  }

  function scrollToSection(index: number): void {
    const element: HTMLDivElement | undefined = sectionElements[index];
    if (element) {
      const elementTop: number = element.offsetTop;
      const elementHeight: number = element.offsetHeight;
      const viewportHeight: number = window.innerHeight;
      const scrollTo: number =
        elementTop - (viewportHeight - elementHeight) / 2;

      window.scrollTo({
        top: scrollTo,
        behavior: "smooth",
      });
    }
  }

  function toggleAutoScroll(): void {
    isAutoScrolling = !isAutoScrolling;

    if (isAutoScrolling) {
      scrollToSection(currentSectionIndex);
      startTimer();
    } else {
      stopTimer();
    }
  }

  function jumpToSection(index: number): void {
    if (index === currentSectionIndex) return;

    stopTimer();
    currentSectionIndex = index;
    scrollToSection(currentSectionIndex);

    // Auto-enable scrolling when jumping to a section
    isAutoScrolling = true;
    startTimer();
  }

  function previousSection(): void {
    if (currentSectionIndex > 0) {
      stopTimer();
      currentSectionIndex--;
      scrollToSection(currentSectionIndex);

      if (isAutoScrolling) {
        startTimer();
      }
    }
  }

  function nextSectionManual(): void {
    if (currentSectionIndex < conversationSections.length - 1) {
      stopTimer();
      currentSectionIndex++;
      scrollToSection(currentSectionIndex);

      if (isAutoScrolling) {
        startTimer();
      }
    }
  }

  function toggleVoice(): void {
    voiceEnabled = !voiceEnabled;

    if (audioPlayer) {
      // Just mute/unmute the audio player - don't pause or reset progress
      audioPlayer.muted = !voiceEnabled;
    }

    // If voice is enabled and we're auto-scrolling but no audio is playing, start it
    if (voiceEnabled && isAutoScrolling && audioPlayer && audioPlayer.paused) {
      playAudioForSection(currentSectionIndex);
    }
  }

  function playAudioForSection(index: number): void {
    if (!voiceEnabled || !audioPlayer) return;

    try {
      // Change source and play
      audioPlayer.src = `/audio/${index}.wav`;
      audioPlayer.load(); // Reload the new source
      audioPlayer.play().catch((error) => {
        console.warn(`Could not play audio for section ${index}:`, error);
      });
    } catch (error) {
      console.warn(`Error playing audio for section ${index}:`, error);
    }
  }

  $: {
    const currentSection = conversationSections[currentSectionIndex];
    if (currentSection) {
      // Use audio duration if available, otherwise fall back to manual duration
      const totalDuration =
        audioDurations[currentSectionIndex] || currentSection.durationMs;
      progressPercent = ((totalDuration - timeRemaining) / totalDuration) * 100;
    } else {
      progressPercent = 0;
    }
  }
</script>

<div class="controls">
  <div class="navigation-buttons">
    <button
      class="nav-btn"
      on:click={previousSection}
      disabled={currentSectionIndex === 0}
    >
      <UpIcon />
    </button>
    <button
      class="nav-btn"
      on:click={nextSectionManual}
      disabled={currentSectionIndex === conversationSections.length - 1}
    >
      <DownIcon />
    </button>
  </div>

  <button class="play-pause-btn" on:click={toggleAutoScroll}>
    {#if isAutoScrolling}
      <PauseIcon />
    {:else}
      <PlayIcon />
    {/if}
  </button>

  <div class="auto-scroll-indicator">
    <span class="label">auto-scrolling</span>
    <div class="status-circle" class:pulsing={isAutoScrolling}></div>
  </div>

  <button class="voice-btn" on:click={toggleVoice}>
    {#if voiceEnabled}
      <SpeakerIcon />
    {:else}
      <SpeakerMutedIcon />
    {/if}
  </button>

  {#if isAutoScrolling}
    <div class="progress-bar">
      <div class="progress-fill" style="width: {progressPercent}%"></div>
    </div>
  {/if}
</div>

<main>
  {#each conversationSections as section, i}
    <div
      class="conversation-section"
      class:active={i === currentSectionIndex}
      class:clickable={i !== currentSectionIndex}
      on:click={() => jumpToSection(i)}
      bind:this={sectionElements[i]}
    >
      <div
        class="speaker-label speaker-{section.speaker
          .toLowerCase()
          .replace(' ', '-')}"
      >
        {section.speaker}
      </div>
      <div
        class="content content-{section.speaker
          .toLowerCase()
          .replace(' ', '-')}"
      >
        {@html section.content.replace(/\n/g, "<br>")}
      </div>
    </div>
  {/each}
</main>

<style>
  .conversation-section {
    margin-bottom: 0.5rem;
    opacity: 0.4;
    transition: opacity 0.3s ease;
    border-radius: 8px;
    padding: 0.75rem;
    border: 1px solid transparent;
    background-color: transparent;
  }

  .conversation-section.active {
    opacity: 1;
  }

  .conversation-section.clickable {
    cursor: pointer;
  }

  .conversation-section.clickable:hover {
    background-color: rgba(0, 0, 0, 0.02);
    border-color: rgba(0, 0, 0, 0.1);
  }

  .speaker-label {
    margin-bottom: 0.5rem;
    padding: 0.2rem 0.4rem;
    border-radius: 0.5rem;
    display: inline-block;
    font-weight: bold;
    font-size: 0.8rem;
  }

  .speaker-human {
    background-color: #e3f2fd;
    color: #1565c0;
  }

  .speaker-artificial-mind {
    background-color: #f3e5f5;
    color: #7b1fa2;
  }

  .speaker-narrator {
    background-color: #e8f5e8;
    color: #2e7d32;
  }

  .content {
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .content-narrator {
    font-style: italic;
  }

  .controls {
    position: fixed;
    top: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    width: 240px;
    height: 60px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.5rem 0.75rem;
    z-index: 100;
  }

  .play-pause-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: background-color 0.2s;
  }

  .play-pause-btn:hover {
    background-color: #f5f5f5;
  }

  .auto-scroll-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .label {
    font-size: 0.8rem;
    color: #666;
  }

  .status-circle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #ccc;
    transition: all 0.3s ease;
  }

  .status-circle.pulsing {
    background-color: #4caf50;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.7;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background-color: #f0f0f0;
    border-radius: 0 0 12px 12px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: #4caf50;
    transition: width 0.1s linear;
  }

  .navigation-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-btn {
    background: none;
    border: none;
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nav-btn:hover:not(:disabled) {
    background-color: #f5f5f5;
    color: #333;
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .voice-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: background-color 0.2s;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .voice-btn:hover {
    background-color: #f5f5f5;
    color: #333;
  }
</style>
