export type AdminNavItem = {
	href: string;
	label: string;
	id: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
	{ id: 'roles', href: '/admin/roles', label: 'Rollen' },
	{ id: 'users', href: '/admin/users', label: 'Benutzer' },
	{ id: 'items', href: '/admin/items', label: 'Items' },
	{ id: 'moderation', href: '/admin/moderation', label: 'Moderation' },
	{ id: 'analytics', href: '/admin/analytics', label: 'Analytics' }
];

/** Panel title for known admin routes (pathname e.g. /admin/roles). */
export function adminPanelTitle(pathname: string): string {
	if (pathname === '/admin/create-user') return 'Benutzer erstellen';
	const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0];
	switch (seg) {
		case 'roles':
			return 'Rollen';
		case 'users':
			return 'Benutzer';
		case 'items':
			return 'Items';
		case 'moderation':
			return 'Moderation';
		case 'analytics':
			return 'Analytics';
		default:
			return 'Administration';
	}
}
