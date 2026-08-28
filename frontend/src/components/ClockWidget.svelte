<script>
  import { onMount } from "svelte";
  import { formatClockDate, formatClockTime } from "../lib/datetime.js";

  let now = $state(new Date());

  const time = $derived(formatClockTime(now));
  const date = $derived(formatClockDate(now));

  onMount(() => {
    const timer = setInterval(() => {
      now = new Date();
    }, 1000);

    return () => clearInterval(timer);
  });
</script>

<article class="clock-card">
  <p class="time">{time}</p>
  <p class="date">{date}</p>
</article>

<style>
  .clock-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    min-height: 7.5rem;
    line-height: 1.2;
  }

  .time {
    margin: 0;
    font-size: 2.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: #e6edf3;
  }

  .date {
    margin: 0.35rem 0 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: #8b949e;
  }
</style>
