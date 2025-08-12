<script lang="ts">
  import { menuItems } from "./menu";
  import type { ConversationChunk } from "./menu";

  export let isVisible = false;
  export let currentSectionIndex = 0;
  export let onMenuItemClick: (index: number) => void;

  function toggleSidebar() {
    isVisible = !isVisible;
  }

  function handleMenuItemClick(item: ConversationChunk) {
    onMenuItemClick(item.index);
  }

  function isCurrentSection(item: ConversationChunk): boolean {
    // Find the next menu item to determine the range
    const currentItemIndex = menuItems.indexOf(item);
    const nextItem = menuItems[currentItemIndex + 1];
    const endIndex = nextItem ? nextItem.index - 1 : Number.MAX_SAFE_INTEGER;
    
    return currentSectionIndex >= item.index && currentSectionIndex <= endIndex;
  }
</script>

<!-- Toggle Button (visible when sidebar is hidden) -->
{#if !isVisible}
  <button class="menu-toggle" on:click={toggleSidebar}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  </button>
{/if}

<!-- Sidebar -->
<div class="sidebar" class:visible={isVisible}>
  <div class="sidebar-header">
    <h3>Navigation</h3>
    <button class="close-btn" on:click={toggleSidebar}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <nav class="menu">
    {#each menuItems as item}
      <button 
        class="menu-item" 
        class:current={isCurrentSection(item)}
        on:click={() => handleMenuItemClick(item)}
      >
        <div class="menu-title">{item.title}</div>
        <div class="menu-subtitle">{item.sentence}</div>
      </button>
    {/each}
  </nav>
</div>

<style>
  .menu-toggle {
    position: fixed;
    top: 2rem;
    left: 1rem;
    z-index: 1000;
    background: white;
    border: none;
    border-radius: 8px;
    padding: 0.75rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    color: #666;
    transition: all 0.2s ease;
    font-family: "Lora", serif;
  }

  .menu-toggle:hover {
    background-color: #f5f5f5;
    color: #333;
    transform: scale(1.05);
  }

  .sidebar {
    width: 280px;
    height: 100vh;
    background: white;
    border-right: 1px solid #e5e5e5;
    overflow-y: auto;
    flex-shrink: 0;
    font-family: "Lora", serif;
    transform: translateX(-100%);
    transition: transform 0.3s ease-in-out;
  }

  .sidebar.visible {
    transform: translateX(0);
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 1.25rem 1rem 1.25rem;
    border-bottom: 1px solid #f0f0f0;
  }

  .close-btn {
    background: none;
    border: none;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    color: rgb(87, 83, 78);
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background-color: #e5e5e5;
    color: #333;
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: rgb(87, 83, 78);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .menu {
    padding: 0.5rem 0;
  }

  .menu-item {
    display: block;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
    padding: 0.75rem 1.25rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .menu-item:hover {
    background-color: #f8f9fa;
  }

  .menu-item.current {
    background-color: #f5f5f5;
  }

  .menu-item.current .menu-title {
    font-weight: 600;
  }

  .menu-title {
    font-size: 0.85rem;
    font-weight: 500;
    color: rgb(87, 83, 78);
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }

  .menu-subtitle {
    font-size: 0.75rem;
    color: rgb(120, 113, 108);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Hide sidebar on small screens */
  @media (max-width: 1000px) {
    .sidebar {
      display: none;
    }
  }
</style>