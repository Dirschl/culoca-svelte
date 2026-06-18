/** LS custom domain is dirschl.com (apex); www.dirschl.com is WordPress and breaks /checkout/*. */
export function normalizeCheckoutUrl(checkoutUrl: string): string {
	try {
		const url = new URL(checkoutUrl);
		if (url.hostname === 'www.dirschl.com' || url.hostname === 'dirschl.lemonsqueezy.com') {
			url.hostname = 'dirschl.com';
			return url.toString();
		}
		return checkoutUrl;
	} catch {
		return checkoutUrl;
	}
}
