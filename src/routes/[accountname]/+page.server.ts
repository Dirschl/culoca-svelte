import type { PageServerLoad } from './$types';
import { loadAccountGalleryPage } from '$lib/server/accountGallery';

export const load: PageServerLoad = async ({ params, url }) => {
  return loadAccountGalleryPage(params.accountname, url.searchParams.get('seite'));
};
