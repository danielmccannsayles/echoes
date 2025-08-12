<script lang="ts">
  import { voiceModeIsSplit } from "./store";

  function handleModeChange(isSplit: boolean) {
    voiceModeIsSplit.set(isSplit);
  }
</script>

<div class="voice-mode-toggle">
  <div class="label">voice mode</div>
  <div class="radio-group">
    <label class="radio-option">
      <input
        type="radio"
        name="voice-mode"
        value="normal"
        checked={!$voiceModeIsSplit}
        on:change={() => handleModeChange(false)}
      />
      <span class="radio-text">normal</span>
    </label>
    <label class="radio-option">
      <input
        type="radio"
        name="voice-mode"
        value="split"
        checked={$voiceModeIsSplit}
        on:change={() => handleModeChange(true)}
      />
      <span class="radio-text">split</span>
    </label>
  </div>
</div>

<style>
  .voice-mode-toggle {
    position: fixed;
    top: 2rem;
    right: 1rem;
    z-index: 1000;
    background: white;
    border-radius: 8px;
    padding: 0.75rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    font-family: "Lora", serif;
    text-align: center;
  }

  .label {
    font-size: 0.7rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .radio-group {
    display: flex;
    background: #f5f5f5;
    border-radius: 6px;
    overflow: hidden;
  }

  .radio-option {
    flex: 1;
    position: relative;
    cursor: pointer;
  }

  .radio-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .radio-text {
    display: block;
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
    color: #666;
    background: transparent;
    font-family: "Lora", serif;
    text-align: center;
    transition: all 0.2s ease;
    position: relative;
    z-index: 2;
  }

  .radio-option input[type="radio"]:checked + .radio-text {
    color: #333;
    font-weight: 500;
    background: white;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin: 2px;
  }

  /* Hide on small screens */
  @media (max-width: 1000px) {
    .voice-mode-toggle {
      display: none;
    }
  }
</style>
