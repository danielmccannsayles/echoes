<script>
  import { conversationSections } from './lib/conversation';
</script>

<main>
  {#each conversationSections as section}
    <div class="conversation-section">
      <div class="speaker-label speaker-{section.speaker.toLowerCase().replace(' ', '-')}">
        {section.speaker}
      </div>
      <div class="content">
        {@html section.content.replace(/\n/g, '<br>')}
      </div>
    </div>
  {/each}
</main>

<style>
  .conversation-section {
    margin-bottom: 2rem;
  }

  .speaker-label {
    margin-bottom: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    display: inline-block;
    font-weight: bold;
    font-size: 0.9rem;
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
</style>