<script>
  import { removeTagName, setTagName } from "../lib/api.js";

  let { tags, onTagsChanged } = $props();

  let drafts = $state({});
  let saving = $state({});
  let error = $state("");

  function getDraft(tag) {
    return drafts[tag.tagId] ?? tag.name ?? "";
  }

  async function saveName(tag) {
    const name = getDraft(tag).trim();
    if (!name) {
      error = "Name cannot be empty";
      return;
    }

    saving = { ...saving, [tag.tagId]: true };
    error = "";

    try {
      await setTagName(tag.tagId, name);
      drafts = { ...drafts, [tag.tagId]: name };
      await onTagsChanged?.();
    } catch (err) {
      error = err.message;
    } finally {
      saving = { ...saving, [tag.tagId]: false };
    }
  }

  async function stopTracking(tag) {
    if (!confirm(`Stop tracking "${tag.name}"? History is kept.`)) {
      return;
    }

    saving = { ...saving, [tag.tagId]: true };
    error = "";

    try {
      await removeTagName(tag.tagId);
      await onTagsChanged?.();
    } catch (err) {
      error = err.message;
    } finally {
      saving = { ...saving, [tag.tagId]: false };
    }
  }
</script>

<section class="panel">
  <header>
    <h2>Discovered tags</h2>
    <p>{tags.length} found nearby</p>
  </header>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if tags.length === 0}
    <p class="empty">No RuuviTags discovered yet.</p>
  {:else}
    <ul>
      {#each tags as tag (tag.tagId)}
        <li>
          <div class="tag-info">
            <span class="name">{tag.name ?? "Unnamed"}</span>
            <span class="meta">{tag.address ?? tag.tagId}</span>
          </div>

          <div class="actions">
            <input
              type="text"
              placeholder="Name this tag"
              value={getDraft(tag)}
              oninput={(event) => {
                drafts = { ...drafts, [tag.tagId]: event.currentTarget.value };
              }}
            />
            <button
              type="button"
              disabled={saving[tag.tagId]}
              onclick={() => saveName(tag)}
            >
              {tag.name ? "Rename" : "Track"}
            </button>
            {#if tag.name}
              <button
                type="button"
                class="secondary"
                disabled={saving[tag.tagId]}
                onclick={() => stopTracking(tag)}
              >
                Untrack
              </button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 1.25rem;
  }

  header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  header p {
    margin: 0.25rem 0 0;
    color: #8b949e;
    font-size: 0.9rem;
  }

  .error {
    color: #ff7b72;
    margin: 1rem 0 0;
  }

  .empty {
    color: #8b949e;
    margin: 1rem 0 0;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  li {
    border: 1px solid #30363d;
    border-radius: 10px;
    overflow: hidden;
  }

  .tag-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.85rem 1rem;
    background: #0d1117;
  }

  .name {
    font-weight: 600;
  }

  .meta {
    font-size: 0.8rem;
    color: #8b949e;
    font-family: monospace;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #0d1117;
    border-top: 1px solid #30363d;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    border: 1px solid #30363d;
    background: #010409;
    color: inherit;
  }

  button {
    padding: 0.55rem 0.85rem;
    border-radius: 8px;
    border: 1px solid #238636;
    background: #238636;
    color: white;
  }

  button.secondary {
    border-color: #30363d;
    background: #21262d;
    color: #e6edf3;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
