import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Remove URL validation - allow any URL for testing
  // if (!targetUrl.includes('culoca.com/item/')) {
  //   return json({ error: 'Invalid Culoca URL format' }, { status: 400 });
  // }

  try {
    // Fetch the page content
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      return json({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }, { status: response.status });
    }
    
    const html = await response.text();
    
    // Extract head section
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    
    if (!headMatch) {
      return json({ error: 'No head section found' }, { status: 404 });
    }
    
    const headContent = headMatch[1];
    
    // Extract individual meta tags and other head elements
    const metaTags = extractMetaTags(headContent);
    const title = extractTitle(headContent);
    const linkTags = headContent.match(/<link[^>]*>/gi) || [];
    const scriptTags = headContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    
    // Extract main image and favicon information
    const mainImage = extractMainImage(headContent);
    const faviconInfo = extractFaviconInfo(headContent);
    const culocaLogoFallback = extractCulocaLogoFallback(headContent);
    
    // Format the head content for better readability
    const formattedHead = headContent
      .replace(/></g, '>\n<')
      .replace(/<meta/g, '\n  <meta')
      .replace(/<title/g, '\n  <title')
      .replace(/<link/g, '\n  <link')
      .replace(/<script/g, '\n  <script')
      .replace(/<style/g, '\n  <style')
      .replace(/<base/g, '\n  <base')
      .replace(/<noscript/g, '\n  <noscript')
      .trim();
    
    return json({ 
      success: true, 
      url: targetUrl,
      headContent: formattedHead,
      metaTags: metaTags,
      title: title,
      linkTags: linkTags,
      scriptTags: scriptTags,
      rawHead: headContent,
      mainImage: mainImage,
      faviconInfo: faviconInfo,
      culocaLogoFallback: culocaLogoFallback
    });
    
  } catch (error: any) {
    return json({ 
      error: error.message || 'Failed to fetch URL' 
    }, { status: 500 });
  }
};

function extractMainImage(headContent: string) {
  // Look for og:image meta tag
  const ogImageMatch = headContent.match(/<meta property="og:image" content="([^"]+)"/i);
  if (ogImageMatch) {
    return {
      type: 'og:image',
      url: ogImageMatch[1],
      source: 'OpenGraph Meta Tag'
    };
  }
  
  // Look for twitter:image meta tag
  const twitterImageMatch = headContent.match(/<meta name="twitter:image" content="([^"]+)"/i);
  if (twitterImageMatch) {
    return {
      type: 'twitter:image',
      url: twitterImageMatch[1],
      source: 'Twitter Meta Tag'
    };
  }
  
  // Look for general image meta tag
  const imageMatch = headContent.match(/<meta name="image" content="([^"]+)"/i);
  if (imageMatch) {
    return {
      type: 'image',
      url: imageMatch[1],
      source: 'Image Meta Tag'
    };
  }
  
  return null;
}

function extractFaviconInfo(headContent: string) {
  const favicons = [];
  
  // Extract all favicon link tags
  const faviconMatches = headContent.match(/<link[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>/gi) || [];
  
  faviconMatches.forEach(match => {
    const hrefMatch = match.match(/href="([^"]+)"/i);
    const sizesMatch = match.match(/sizes="([^"]+)"/i);
    const typeMatch = match.match(/type="([^"]+)"/i);
    const relMatch = match.match(/rel="([^"]+)"/i);
    
    if (hrefMatch) {
      favicons.push({
        url: hrefMatch[1],
        sizes: sizesMatch ? sizesMatch[1] : null,
        type: typeMatch ? typeMatch[1] : null,
        rel: relMatch ? relMatch[1] : null,
        fullTag: match.trim()
      });
    }
  });
  
  return {
    count: favicons.length,
    favicons: favicons,
    hasMultipleSizes: favicons.some(f => f.sizes && f.sizes.includes(' ')),
    hasAppleTouchIcon: favicons.some(f => f.rel === 'apple-touch-icon')
  };
}

function extractTitle(headContent: string) {
  const titleMatch = headContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

function extractMetaTags(headContent: string) {
  const metaMatches = headContent.match(/<meta[^>]*>/gi) || [];
  const metaTags = [];
  
  metaMatches.forEach(match => {
    const nameMatch = match.match(/name="([^"]+)"/i);
    const propertyMatch = match.match(/property="([^"]+)"/i);
    const contentMatch = match.match(/content="([^"]+)"/i);
    
    metaTags.push({
      name: nameMatch ? nameMatch[1] : null,
      property: propertyMatch ? propertyMatch[1] : null,
      content: contentMatch ? contentMatch[1] : null,
      fullTag: match.trim()
    });
  });
  
  return metaTags;
}

function extractCulocaLogoFallback(headContent: string) {
  // Check if there are any references to culoca logo fallback
  const culocaLogoMatch = headContent.match(/culoca.*logo/gi);
  const fallbackMatch = headContent.match(/fallback/gi);
  
  return {
    hasCulocaLogoReference: !!culocaLogoMatch,
    hasFallbackReference: !!fallbackMatch,
    culocaLogoReferences: culocaLogoMatch || [],
    fallbackReferences: fallbackMatch || []
  };
} 