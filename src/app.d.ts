// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: {
				id: string;
			};
		}
		// interface PageData {}
		interface PageData {
			culocaSales?: {
				enabled: boolean;
				standardPriceCents: number;
				extendedPriceCents: number;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
