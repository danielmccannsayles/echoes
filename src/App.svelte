<script lang="ts">
  import { conversationSections } from "./lib/conversation";
  import { onMount, onDestroy } from "svelte";
  import PlayIcon from "./lib/icons/PlayIcon.svelte";
  import PauseIcon from "./lib/icons/PauseIcon.svelte";

  let currentSectionIndex: number = 0;
  let isAutoScrolling: boolean = false;
  let timeRemaining: number = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let sectionElements: HTMLDivElement[] = [];

  onMount(() => {
    if (isAutoScrolling) {
      startTimer();
    }
  });

  onDestroy(() => {
    if (timer) {
      clearInterval(timer);
    }
  });

  function startTimer(): void {
    if (currentSectionIndex >= conversationSections.length) return;

    timeRemaining = conversationSections[currentSectionIndex].durationMs;

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

  $: progressPercent = conversationSections[currentSectionIndex]
    ? ((conversationSections[currentSectionIndex].durationMs - timeRemaining) /
        conversationSections[currentSectionIndex].durationMs) *
      100
    : 0;
</script>

<div class="controls">
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
    width: 200px;
    height: 60px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
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
</style>
