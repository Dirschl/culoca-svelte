let lemonReady: Promise<void> | null = null;
let eventsConfigured = false;

declare global {
	interface Window {
		createLemonSqueezy?: () => void;
		LemonSqueezy?: {
			Setup: (opts: { eventHandler: (event: { event: string }) => void }) => void;
			Url: { Open: (url: string) => void };
		};
	}
}

function loadLemonJs(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if (window.LemonSqueezy) {
		window.createLemonSqueezy?.();
		return Promise.resolve();
	}
	if (!lemonReady) {
		lemonReady = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://app.lemonsqueezy.com/js/lemon.js';
			script.defer = true;
			script.onload = () => {
				window.createLemonSqueezy?.();
				resolve();
			};
			script.onerror = () => reject(new Error('Lemon.js konnte nicht geladen werden'));
			document.head.appendChild(script);
		});
	}
	return lemonReady;
}

function ensureCheckoutEvents(onSuccessRedirect: string) {
	if (eventsConfigured || !window.LemonSqueezy) return;
	window.LemonSqueezy.Setup({
		eventHandler: (event) => {
			if (event.event === 'Checkout.Success') {
				window.location.href = onSuccessRedirect;
			}
		}
	});
	eventsConfigured = true;
}

/** Opens Lemon Squeezy checkout as overlay so the user stays on culoca.com. */
export async function openLemonCheckout(
	checkoutUrl: string,
	options?: { onSuccessRedirect?: string }
): Promise<void> {
	await loadLemonJs();
	if (!window.LemonSqueezy) {
		throw new Error('Lemon.js nicht verfügbar');
	}
	if (options?.onSuccessRedirect) {
		ensureCheckoutEvents(options.onSuccessRedirect);
	}
	window.LemonSqueezy.Url.Open(checkoutUrl);
	window.createLemonSqueezy?.();
}
