import { VALID_CONTENT_TYPE_SLUGS } from '$lib/content/types';

export function match(param: string) {
  return VALID_CONTENT_TYPE_SLUGS.includes(param);
}
