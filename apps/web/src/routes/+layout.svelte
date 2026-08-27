<script lang="ts">
	let { children } = $props();
</script>

<main>
	{@render children()}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		margin: 0;
		padding: 0;
		background: #f5f3ff;
		color: #211a36;
		-webkit-font-smoothing: antialiased;
	}

	main {
		min-height: 100vh;
	}

	:global(button), :global(input), :global(textarea), :global(select) {
		font: inherit;
	}

	:global(button) {
		-webkit-tap-highlight-color: transparent;
	}
</style>
