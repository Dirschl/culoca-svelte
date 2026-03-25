<script lang="ts">
	export let display_name_public = '';
	export let default_creator_name = '';
	export let legal_entity_name = '';
	export let copyright_holder_name = '';
	export let organization_name = '';
	export let public_contact_name = '';
	export let default_credit_text = '';
	export let default_copyright_notice = '';
	export let default_author_meta = '';
	export let default_license_url = '';
	export let use_exif_creator_override = false;
	export let use_exif_credit_override = false;
	export let use_exif_copyright_override = false;
</script>

<div class="profile-section-form">
	<div class="card">
		<h3 class="section-title">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 2l3 7h7l-5.5 4.1L18 22l-6-4-6 4 1.5-8.9L2 9h7l3-7z" />
			</svg>
			Attribution & Rechte
		</h3>

		<p class="help-text">
			Für Google Bilder und die eingebetteten Structured Data müssen „Ersteller“ und „Copyright“ eindeutig
			und konsistent sein. Jedes Foto kann abweichende EXIF-Rechte/Creator enthalten – ihr könnt per Checkbox
			steuern, wann EXIF überschreiben darf.
		</p>

		<div class="form-group">
			<label for="displayNamePublic">Öffentlicher Name (Backup für Attribution)</label>
			<input
				id="displayNamePublic"
				type="text"
				bind:value={display_name_public}
				placeholder="z.B. Johann Dirschl"
			/>
		</div>

		<div class="form-group">
			<label for="defaultCreatorName">Creator/Photographer Default</label>
			<input
				id="defaultCreatorName"
				type="text"
				bind:value={default_creator_name}
				placeholder="z.B. Johann Dirschl oder Firmenname"
			/>
		</div>

		<div class="form-group">
			<label for="legalEntityName">Legal Entity / Organisation (optional)</label>
			<input
				id="legalEntityName"
				type="text"
				bind:value={legal_entity_name}
				placeholder="z.B. DIRSCHL.com GmbH"
			/>
		</div>

		<div class="form-group">
			<label for="copyrightHolderName">Copyright Holder (Organisation)</label>
			<input
				id="copyrightHolderName"
				type="text"
				bind:value={copyright_holder_name}
				placeholder="z.B. DIRSCHL.com GmbH"
			/>
		</div>

		<div class="form-group">
			<label for="organizationName">Organisation (Fallback)</label>
			<input
				id="organizationName"
				type="text"
				bind:value={organization_name}
				placeholder="z.B. DIRSCHL.com GmbH"
			/>
		</div>

		<div class="form-group">
			<label for="publicContactName">Öffentlicher Kontaktname (optional)</label>
			<input
				id="publicContactName"
				type="text"
				bind:value={public_contact_name}
				placeholder="z.B. Ansprechpartner / Team"
			/>
		</div>

		<div class="form-group">
			<label for="defaultCreditText">Default CreditText</label>
			<input
				id="defaultCreditText"
				type="text"
				bind:value={default_credit_text}
				placeholder="Foto: &lcub;creator&rcub;"
			/>
			<span class="help-text">Platzhalter: <code>&lcub;creator&rcub;</code></span>
		</div>

		<div class="form-group">
			<label for="defaultCopyrightNotice">Default CopyrightNotice</label>
			<input
				id="defaultCopyrightNotice"
				type="text"
				bind:value={default_copyright_notice}
				placeholder="© &lcub;year&rcub; &lcub;copyrightHolder&rcub;. Alle Rechte vorbehalten."
			/>
			<span class="help-text"
				>Platzhalter: <code>&lcub;year&rcub;</code>, <code>&lcub;copyrightHolder&rcub;</code>,
				<code>&lcub;holder&rcub;</code>, <code>&lcub;creator&rcub;</code></span
			>
		</div>

		<div class="form-group">
			<label for="defaultAuthorMeta"
				>Default Autor-Text für &lt;meta name=&quot;author&quot;&gt;</label
			>
			<input
				id="defaultAuthorMeta"
				type="text"
				bind:value={default_author_meta}
				placeholder="z.B. Johann Dirschl"
			/>
		</div>

		<div class="form-group">
			<label for="defaultLicenseUrl">License URL (für JSON-LD)</label>
			<input
				id="defaultLicenseUrl"
				type="text"
				bind:value={default_license_url}
				placeholder="https://culoca.com/web/license"
			/>
		</div>

		<div class="form-group">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={use_exif_creator_override} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">EXIF Creator/Photographer darf überschreiben</span>
			</label>
		</div>

		<div class="form-group">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={use_exif_credit_override} />
				<span class="toggle-switch"></span>
				<span class="toggle-text">EXIF Creator darf auch CreditText beeinflussen</span>
			</label>
		</div>

		<div class="form-group">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={use_exif_copyright_override} />
				<span class="toggle-switch"></span>
				<span class="toggle-text"
					>EXIF Copyright darf CopyrightHolder/CopyrightNotice überschreiben</span
				>
			</label>
		</div>
	</div>
</div>

<style>
	@import '$lib/profile/profileSectionFormSurface.css';
</style>
