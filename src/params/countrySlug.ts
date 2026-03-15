const VALID_COUNTRY_SLUGS = ['de', 'at', 'ch'];

export function match(param: string) {
  return VALID_COUNTRY_SLUGS.includes(param);
}
