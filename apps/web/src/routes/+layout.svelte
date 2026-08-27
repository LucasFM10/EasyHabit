<script lang="ts">
	let { children } = $props();
</script>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		margin: 0;
		padding: 0;
		background-color: #f8fafc;
		color: #0f172a;
	}

	main {
		max-width: 900px;
		margin: 2rem auto;
		padding: 0 1rem;
	}
</style>
