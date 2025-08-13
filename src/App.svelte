<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { conversationSections } from "./lib/conversation";
  import MenuBar from "./lib/MenuBar.svelte";
  import Controls from "./lib/Controls.svelte";
  import VoiceModeToggle from "./lib/VoiceModeToggle.svelte";
  import {
    currentSectionIndex,
    isAutoScrolling,
    timeRemaining,
    voiceEnabled,
    voiceModeIsSplit,
    audioDurations,
    progressPercent,
    isMenuBarVisible,
    currentSection,
    audioPath,
  } from "./lib/store";

  let timer: ReturnType<typeof setInterval> | null = null;
  let sectionElements: HTMLDivElement[] = [];
  let audioPlayer: HTMLAudioElement | null = null;
  let loadingAudioDurations = false;

  onMount(async () => {
    // Load audio durations from generated file
    loadAudioDurations();

    // Initialize audio player
    audioPlayer = new Audio();

    if ($isAutoScrolling) {
      startTimer();
    }
  });

  async function loadAudioDurations() {
    if (loadingAudioDurations) return;

    loadingAudioDurations = true;
    try {
      const currentPath = $audioPath;
      const response = await fetch(`${currentPath}/durations.json`);
      if (response.ok) {
        const durations = await response.json();
        audioDurations.set(durations);
      } else {
        console.warn("Could not load durations.json, using fallback durations");
      }
    } catch (error) {
      console.warn("Error loading audio durations:", error);
    } finally {
      loadingAudioDurations = false;
    }
  }

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
    if ($currentSectionIndex >= conversationSections.length) return;

    // Use audio duration if available, otherwise fall back to manual duration
    const audioDuration = $audioDurations[$currentSectionIndex];
    timeRemaining.set(
      audioDuration || conversationSections[$currentSectionIndex].durationMs
    );

    // Start audio playback if voice is enabled
    if ($voiceEnabled) {
      playAudioForSection($currentSectionIndex);
    }

    timer = setInterval(() => {
      timeRemaining.update((time) => {
        const newTime = time - 100;
        if (newTime <= 0) {
          nextSection();
          return 0;
        }
        return newTime;
      });
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
    if ($currentSectionIndex < conversationSections.length - 1) {
      currentSectionIndex.update((index) => index + 1);
      scrollToSection($currentSectionIndex);

      if ($isAutoScrolling) {
        stopTimer();
        startTimer();
      }
    } else {
      isAutoScrolling.set(false);
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
    isAutoScrolling.update((value) => !value);

    if ($isAutoScrolling) {
      scrollToSection($currentSectionIndex);
      startTimer();
    } else {
      stopTimer();
    }
  }

  function jumpToSection(index: number): void {
    if (index === $currentSectionIndex) return;

    stopTimer();
    currentSectionIndex.set(index);
    scrollToSection($currentSectionIndex);

    // Auto-enable scrolling when jumping to a section
    isAutoScrolling.set(true);
    startTimer();
  }

  function handleMenuItemClick(index: number): void {
    jumpToSection(index);
  }

  function previousSection(): void {
    if ($currentSectionIndex > 0) {
      stopTimer();
      currentSectionIndex.update((index) => index - 1);
      scrollToSection($currentSectionIndex);

      if ($isAutoScrolling) {
        startTimer();
      }
    }
  }

  function nextSectionManual(): void {
    if ($currentSectionIndex < conversationSections.length - 1) {
      stopTimer();
      currentSectionIndex.update((index) => index + 1);
      scrollToSection($currentSectionIndex);

      if ($isAutoScrolling) {
        startTimer();
      }
    }
  }

  function toggleVoice(): void {
    voiceEnabled.update((value) => !value);

    if (audioPlayer) {
      // Just mute/unmute the audio player - don't pause or reset progress
      audioPlayer.muted = !$voiceEnabled;
    }

    // If voice is enabled and we're auto-scrolling but no audio is playing, start it
    if (
      $voiceEnabled &&
      $isAutoScrolling &&
      audioPlayer &&
      audioPlayer.paused
    ) {
      playAudioForSection($currentSectionIndex);
    }
  }

  function playAudioForSection(index: number): void {
    if (!$voiceEnabled || !audioPlayer) return;

    try {
      // Change source and play
      audioPlayer.src = `${$audioPath}/${index}.wav`;
      audioPlayer.load(); // Reload the new source
      audioPlayer.play().catch((error) => {
        console.warn(`Could not play audio for section ${index}:`, error);
      });
    } catch (error) {
      console.warn(`Error playing audio for section ${index}:`, error);
    }
  }

  // Reactive statement for progress calculation
  $: {
    if ($currentSection) {
      // Use audio duration if available, otherwise fall back to manual duration
      const totalDuration =
        $audioDurations[$currentSectionIndex] || $currentSection.durationMs;
      progressPercent.set(
        ((totalDuration - $timeRemaining) / totalDuration) * 100
      );
    } else {
      progressPercent.set(0);
    }
  }

  // Reactive statement to reload audio durations when voice mode changes
  $: {
    if ($audioPath) {
      loadAudioDurations();
    }
  }
</script>

<div class="app">
  <MenuBar onMenuItemClick={handleMenuItemClick} />
  <VoiceModeToggle />

  <Controls
    onToggleAutoScroll={toggleAutoScroll}
    onPreviousSection={previousSection}
    onNextSection={nextSectionManual}
    onToggleVoice={toggleVoice}
  />

  <div class="main-content" class:sidebar-visible={$isMenuBarVisible}>
    <main>
      {#each conversationSections as section, i}
        <div
          class="conversation-section"
          class:active={i === $currentSectionIndex}
          class:clickable={i !== $currentSectionIndex}
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
  </div>
</div>

<style>
  .app {
    min-height: 100vh;
  }

  .main-content {
    margin-left: 0;
    transition: margin-left 0.3s ease-in-out;
    min-width: 0; /* Prevents flex item from overflowing */
  }

  .main-content.sidebar-visible {
    margin-left: 280px;
  }

  /* Hide sidebar on small screens, make main content full width */
  @media (max-width: 1000px) {
    .main-content {
      width: 100%;
      margin-left: 0 !important;
    }
  }

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
</style>
