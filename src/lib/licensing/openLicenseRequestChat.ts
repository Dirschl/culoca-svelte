/** Chat mit Ersteller öffnen — Vorlage für Lizenzanfrage. */

export function buildLicenseRequestDraft(itemTitle?: string | null): string {
	const title = itemTitle?.trim() || 'dieses Foto';
	return `Hallo, ich interessiere mich für eine kommerzielle Lizenz für „${title}“ auf Culoca. Können Sie mir Informationen zu Nutzungsrechten und Konditionen geben?`;
}

export function openLicenseRequestChat(args: {
	creatorUserId: string;
	itemId: string;
	itemTitle?: string | null;
}) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent('culoca:toggle-chat', {
			detail: {
				chatWith: args.creatorUserId,
				item: args.itemId,
				draft: buildLicenseRequestDraft(args.itemTitle)
			}
		})
	);
}
