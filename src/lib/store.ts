import { writable, derived } from 'svelte/store';
import { conversationSections } from './conversation';

export const currentSectionIndex = writable<number>(0);
export const isAutoScrolling = writable<boolean>(false);
export const timeRemaining = writable<number>(0);
export const voiceEnabled = writable<boolean>(true);
export const audioDurations = writable<Record<number, number>>({});
export const progressPercent = writable<number>(0);
export const isMenuBarVisible = writable<boolean>(false);

export const currentSection = derived(
  currentSectionIndex,
  ($currentSectionIndex) => conversationSections[$currentSectionIndex]
);

export const isAtFirstSection = derived(
  currentSectionIndex,
  ($currentSectionIndex) => $currentSectionIndex === 0
);

export const isAtLastSection = derived(
  currentSectionIndex,
  ($currentSectionIndex) => $currentSectionIndex === conversationSections.length - 1
);