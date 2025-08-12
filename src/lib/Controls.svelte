<script lang="ts">
  import PlayIcon from "./icons/PlayIcon.svelte";
  import PauseIcon from "./icons/PauseIcon.svelte";
  import UpIcon from "./icons/UpIcon.svelte";
  import DownIcon from "./icons/DownIcon.svelte";
  import SpeakerIcon from "./icons/SpeakerIcon.svelte";
  import SpeakerMutedIcon from "./icons/SpeakerMutedIcon.svelte";
  import { 
    isAutoScrolling, 
    voiceEnabled, 
    progressPercent, 
    isAtFirstSection, 
    isAtLastSection 
  } from "./store";

  export let onToggleAutoScroll: () => void;
  export let onPreviousSection: () => void;
  export let onNextSection: () => void;
  export let onToggleVoice: () => void;
</script>

<div class="controls">
  <div class="navigation-buttons">
    <button
      class="nav-btn"
      on:click={onPreviousSection}
      disabled={$isAtFirstSection}
    >
      <UpIcon />
    </button>
    <button
      class="nav-btn"
      on:click={onNextSection}
      disabled={$isAtLastSection}
    >
      <DownIcon />
    </button>
  </div>

  <button class="play-pause-btn" on:click={onToggleAutoScroll}>
    {#if $isAutoScrolling}
      <PauseIcon />
    {:else}
      <PlayIcon />
    {/if}
  </button>

  <div class="auto-scroll-indicator">
    <span class="label">auto-scrolling</span>
    <div class="status-circle" class:pulsing={$isAutoScrolling}></div>
  </div>

  <button class="voice-btn" on:click={onToggleVoice}>
    {#if $voiceEnabled}
      <SpeakerIcon />
    {:else}
      <SpeakerMutedIcon />
    {/if}
  </button>

  {#if $isAutoScrolling}
    <div class="progress-bar">
      <div class="progress-fill" style="width: {$progressPercent}%"></div>
    </div>
  {/if}
</div>

<style>
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