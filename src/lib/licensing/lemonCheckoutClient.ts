import { normalizeCheckoutUrl } from '$lib/licensing/checkoutUrl';

export function redirectToLemonCheckout(checkoutUrl: string): void {
	window.location.assign(normalizeCheckoutUrl(checkoutUrl));
}
