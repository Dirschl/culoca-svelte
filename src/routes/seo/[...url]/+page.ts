export function load({ params, url }: { params: { url?: string }; url: URL }) {
  const queryUrl = url.searchParams.get('url');

  let targetUrl = '';
  let directUrl = false;
  if (queryUrl) {
    targetUrl = queryUrl;
  } else if (params.url) {
    let raw = params.url;
    raw = raw.replace(/^(https?):\/(?!\/)/, '$1://');
    targetUrl = raw;
    directUrl = true;
  }

  return { targetUrl, directUrl };
}
