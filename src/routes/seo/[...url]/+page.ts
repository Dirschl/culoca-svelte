export function load({ params, url }: { params: { url?: string }; url: URL }) {
  const queryUrl = url.searchParams.get('url');

  let targetUrl = '';
  if (queryUrl) {
    targetUrl = queryUrl;
  } else if (params.url) {
    let raw = params.url;
    raw = raw.replace(/^(https?):\/(?!\/)/, '$1://');
    targetUrl = raw;
  }

  return { targetUrl };
}
