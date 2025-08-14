import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { slug } = params;

  if (!slug) {
    // Return default favicon for missing slug
    throw redirect(302, '/culoca-icon.png');
  }

  // For now, just redirect to default favicon
  // This prevents 500 errors while we figure out the image processing issues
  throw redirect(302, '/culoca-icon.png');
}; 