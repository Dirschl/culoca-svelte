/** Use LS-hosted checkout in the same tab (avoids lemon.js rewriting to a broken custom domain). */
export function redirectToLemonCheckout(checkoutUrl: string): void {
	window.location.assign(ensureLemonHostedCheckoutUrl(checkoutUrl));
}

function ensureLemonHostedCheckoutUrl(checkoutUrl: string): string {
	try {
		const url = new URL(checkoutUrl);
		if (url.hostname.endsWith('.lemonsqueezy.com')) return checkoutUrl;
		if (url.hostname === 'dirschl.com' || url.hostname === 'www.dirschl.com') {
			url.hostname = 'dirschl.lemonsqueezy.com';
			return url.toString();
		}
		return checkoutUrl;
	} catch {
		return checkoutUrl;
	}
}
