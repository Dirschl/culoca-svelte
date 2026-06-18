<script lang="ts">
	export let culoca_licensing_opt_in = false;
	export let culoca_licensing_auto_approve = false;
	/** Rollenrecht culoca_license_auto_approve oder manage_culoca_licensing */
	export let canAutoApproveLicenses = false;
</script>

<section class="profile-section-block" aria-labelledby="licensing-heading">
	<h2 id="licensing-heading">Culoca-Bildlizenzen</h2>

	<p class="hint">
		Culoca verkauft Bildlizenzen kuratiert über DIRSCHL.com. Wenn Sie zustimmen, dürfen wir Ihre
		öffentlichen Fotos im Shop anbieten. Ohne Zustimmung sind Ihre Bilder nicht kaufbar.
	</p>

	<label class="opt-in-row">
		<input type="checkbox" bind:checked={culoca_licensing_opt_in} />
		<span>
			Ich erlaube Culoca, meine öffentlichen Fotos kommerziell zu lizenzieren. Ich bestätige, dass ich
			die erforderlichen Rechte an meinen Bildern habe.
		</span>
	</label>

	{#if canAutoApproveLicenses}
		<label class="opt-in-row auto-approve-row" class:disabled={!culoca_licensing_opt_in}>
			<input
				type="checkbox"
				bind:checked={culoca_licensing_auto_approve}
				disabled={!culoca_licensing_opt_in}
			/>
			<span>
				<strong>Autofreigabe eigener Bilder:</strong> Neue und bestehende Fotos sind standardmäßig im
				Culoca-Shop freigegeben. Einzelne Bilder können Sie später unter „Stock konfigurieren“ wieder
				deaktivieren.
			</span>
		</label>
	{/if}

	<p class="legal-hint">
		Details: <a href="/web/license">Lizenzinformationen</a> ·
		<a href="/web/widerruf">Widerrufsbelehrung</a>
	</p>
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

	.opt-in-row.disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.auto-approve-row {
		border-color: color-mix(in srgb, var(--culoca-orange, #ee7221) 35%, var(--border-color));
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
