import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { resolveProfileByPermalinkSegment } from '$lib/server/accountGallery';

export const load: PageServerLoad = async ({ params, url }) => {
  const profile = await resolveProfileByPermalinkSegment(params.accountname);
  if (!profile?.id) {
    throw redirect(302, '/galerie');
  }

  const target = new URL('/galerie', url);
  for (const [key, value] of url.searchParams.entries()) {
    target.searchParams.set(key, value);
  }
  target.searchParams.set('user_id', profile.id);
  if (profile.accountname) {
    target.searchParams.set('account', profile.accountname);
  } else {
    target.searchParams.delete('account');
  }

  throw redirect(301, `${target.pathname}${target.search}`);
};
