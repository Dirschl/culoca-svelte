import { SITE_URL } from '$lib/seo/site';

function normalizeConfiguredHost(host: string | undefined): string | null {
	const normalized = host?.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
	return normalized || null;
}

/** Ensure checkout uses the configured checkout host, falling back to apex host normalization. */
export function normalizeCheckoutUrl(checkoutUrl: string): string {
	try {
		const url = new URL(checkoutUrl);
		const checkoutHost = normalizeConfiguredHost(
			typeof process !== 'undefined' ? process.env.LEMONSQUEEZY_CHECKOUT_HOST : undefined
		);
		if (checkoutHost) {
			url.hostname = checkoutHost;
			return url.toString();
		}

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
