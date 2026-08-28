<script>
  import HistoryChart from "./HistoryChart.svelte";
  import ReadingCard from "./ReadingCard.svelte";

  let { reading } = $props();
</script>

<article class="monitor">
  <ReadingCard {reading} />
  <HistoryChart tagId={reading.tagId}/>
</article>

<style>
  .monitor {
    display: flex;
    flex-direction: column;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
  }

  .monitor :global(.card) {
    border: 0;
    border-radius: 0;
    border-bottom: 1px solid #30363d;
  }
</style>
