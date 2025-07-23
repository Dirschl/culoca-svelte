import { describe, expect, it } from 'vitest';

describe('/+page.svelte', () => {
	it('should be importable', async () => {
		// Just test that the module can be imported without errors
		const PageModule = await import('./+page.svelte');
		expect(PageModule).toBeDefined();
	});
});
