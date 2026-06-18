<script lang="ts">
	export let culoca_licensing_opt_in = false;
	export let isLicenseCuratorProfile = false;
</script>

<section class="profile-section-block" aria-labelledby="licensing-heading">
	<h2 id="licensing-heading">Culoca-Bildlizenzen</h2>

	{#if isLicenseCuratorProfile}
		<p class="hint">
			Als Culoca-Kurator können Sie eigene Bilder nach Freigabe im Shop anbieten. Die Einzelfreigabe
			erfolgt pro Bild unter „Stock konfigurieren“ bzw. im Dashboard.
		</p>
	{:else}
		<p class="hint">
			Culoca verkauft Bildlizenzen derzeit kuratiert über DIRSCHL.com. Wenn Sie zustimmen, dürfen
			wir Ihre Fotos <strong>nach Einzelfreigabe</strong> im Shop anbieten. Ohne Zustimmung sind
			Ihre Bilder nicht kaufbar.
		</p>

		<label class="opt-in-row">
			<input type="checkbox" bind:checked={culoca_licensing_opt_in} />
			<span>
				Ich erlaube Culoca, meine öffentlichen Fotos nach individueller Prüfung kommerziell zu
				lizenzieren. Ich bestätige, dass ich die erforderlichen Rechte an meinen Bildern habe.
			</span>
		</label>

		<p class="legal-hint">
			Details: <a href="/web/license">Lizenzinformationen</a> ·
			<a href="/web/widerruf">Widerrufsbelehrung</a>
		</p>
	{/if}
</section>

<style>
	.profile-section-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.hint {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.55;
		max-width: 68ch;
	}

	.opt-in-row {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
		padding: 1rem;
		border: 1px solid var(--border-color);
		border-radius: 10px;
		background: var(--bg-tertiary);
		cursor: pointer;
	}

	.opt-in-row input {
		margin-top: 0.2rem;
		flex-shrink: 0;
	}

	.legal-hint {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-muted);
	}
</style>
