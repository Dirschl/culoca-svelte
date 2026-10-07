#!/usr/bin/env bash
set -euo pipefail

mode="${1:-development}"

node --input-type=module - "$mode" <<'NODE'
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

const mode = process.argv[2] || 'development';
const env = process.env;
const missing = [];
const requireOne = (names) => {
	if (!names.some((name) => env[name]?.trim())) missing.push(names.join(' or '));
};
const requireAll = (names) => {
	for (const name of names) if (!env[name]?.trim()) missing.push(name);
};

requireOne(['SUPABASE_URL', 'PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL']);
requireOne(['PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);
requireAll(['SUPABASE_SERVICE_ROLE_KEY']);

if (mode === 'production') {
	requireAll([
		'CULOCA_SALES_ENABLED',
		'LEMONSQUEEZY_API_KEY',
		'LEMONSQUEEZY_STORE_ID',
		'LEMONSQUEEZY_WEBHOOK_SECRET',
		'LEMONSQUEEZY_VARIANT_STANDARD_ID',
		'LEMONSQUEEZY_VARIANT_EXTENDED_ID'
	]);
	if (env.CULOCA_SALES_ENABLED !== 'true') {
		missing.push('CULOCA_SALES_ENABLED=true');
	}
}

if (missing.length) {
	console.error(`[predeploy] Missing configuration (${mode}): ${missing.join(', ')}`);
	process.exit(1);
}

const supabaseUrl = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false }
});

for (const table of ['items', 'profiles', 'license_purchases', 'license_cart_items']) {
	const { error } = await supabase.from(table).select('id', { count: 'exact', head: true });
	if (error) {
		console.error(`[predeploy] Database check failed for ${table}: ${error.message}`);
		process.exit(1);
	}
}

console.log(`[predeploy] ${mode} configuration and required database tables are ready.`);
NODE
