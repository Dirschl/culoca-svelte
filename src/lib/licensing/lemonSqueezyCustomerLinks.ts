/**
 * Öffentliche Lemon-Squeezy-URLs für Käufer (Culoca-Store).
 * MoR = Merchant of Record; Rechnungen & Rückerstattungen laufen primär über LS.
 */
export const LEMON_SQUEEZY_CUSTOMER_LINKS = {
	home: 'https://www.lemonsqueezy.com',
	help: 'https://www.lemonsqueezy.com/help',
	chargeHelp: 'https://www.lemonsqueezy.com/why-did-lemon-squeeezy-charge-me',
	buyerTerms: 'https://www.lemonsqueezy.com/buyer-terms',
	privacy: 'https://www.lemonsqueezy.com/privacy',
	myOrders: 'https://app.lemonsqueezy.com/my-orders',
	/** Culoca-Store: Bestellungen & Rechnungen (Magic-Link per E-Mail) */
	culocaBilling: 'https://culoca.lemonsqueezy.com/billing',
	myOrdersDocs: 'https://docs.lemonsqueezy.com/help/online-store/my-orders'
} as const;
