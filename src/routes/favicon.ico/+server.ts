import { redirect } from '@sveltejs/kit';

export async function GET() {
  // Redirect favicon.ico requests to the Culoca PNG icon
  throw redirect(301, '/culoca-icon.png');
} 