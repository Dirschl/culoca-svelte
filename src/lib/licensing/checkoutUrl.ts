import { SITE_URL } from '$lib/seo/site';

/** Ensure checkout uses apex host (e.g. culoca.com not www.culoca.com). */
export function normalizeCheckoutUrl(checkoutUrl: string): string {
	try {
		const url = new URL(checkoutUrl);
		const apex = new URL(SITE_URL).hostname.replace(/^www\./, '');

		if (url.hostname === `www.${apex}`) {
			url.hostname = apex;
			return url.toString();
		}

		return checkoutUrl;
	} catch {
		return checkoutUrl;
	}
}
