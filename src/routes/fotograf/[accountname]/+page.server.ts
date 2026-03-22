import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url }) => {
  const location = `/${params.accountname.toLowerCase()}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}`;
  throw redirect(301, location);
};
