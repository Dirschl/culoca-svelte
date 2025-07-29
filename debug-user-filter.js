// Debug User Filter State
// Run this in the browser console to check the user filter state

console.log('=== Debug User Filter State ===');

// Check if filterStore is available
if (typeof window !== 'undefined' && window.filterStore) {
  console.log('FilterStore available:', window.filterStore);
} else {
  console.log('FilterStore not available on window object');
}

// Check localStorage for filter state
const storedFilters = localStorage.getItem('culoca-filters');
if (storedFilters) {
  console.log('Stored filters:', JSON.parse(storedFilters));
} else {
  console.log('No stored filters found');
}

// Check URL parameters
const urlParams = new URLSearchParams(window.location.search);
console.log('URL user_id parameter:', urlParams.get('user_id'));
console.log('URL user parameter:', urlParams.get('user'));

// Check if galleryStore is available
if (typeof window !== 'undefined' && window.galleryStore) {
  console.log('GalleryStore available:', window.galleryStore);
} else {
  console.log('GalleryStore not available on window object');
}

// Check current gallery parameters
if (typeof window !== 'undefined' && window.galleryParams) {
  console.log('Current gallery params:', window.galleryParams);
} else {
  console.log('Gallery params not available on window object');
}

console.log('=== End Debug ==='); 