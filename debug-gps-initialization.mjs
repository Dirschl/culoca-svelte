// Debug GPS initialization and gallery loading
// Run this in the browser console to test

console.log('🔍 Debug GPS and Gallery Initialization');

// Test 1: Check if GPS coordinates are available
function checkGPSAvailability() {
  console.log('📍 GPS Availability Check:');
  
  // Check window object
  const windowLat = (window as any).userLat;
  const windowLon = (window as any).userLon;
  console.log('Window GPS:', { lat: windowLat, lon: windowLon });
  
  // Check localStorage
  const storedLat = localStorage.getItem('userLat');
  const storedLon = localStorage.getItem('userLon');
  console.log('LocalStorage GPS:', { lat: storedLat, lon: storedLon });
  
  // Check sessionStorage
  const sessionLat = sessionStorage.getItem('userLat');
  const sessionLon = sessionStorage.getItem('userLon');
  console.log('SessionStorage GPS:', { lat: sessionLat, lon: sessionLon });
  
  return { windowLat, windowLon, storedLat, storedLon, sessionLat, sessionLon };
}

// Test 2: Check gallery store state
function checkGalleryStore() {
  console.log('🖼️ Gallery Store Check:');
  
  // Check if galleryItems store exists
  if (typeof window !== 'undefined' && (window as any).__SVELTE__) {
    console.log('Svelte stores available');
  } else {
    console.log('Svelte stores not available');
  }
  
  // Check if gallery is initialized
  const galleryInitialized = document.querySelector('[data-gallery-initialized]');
  console.log('Gallery initialized element:', galleryInitialized);
  
  return galleryInitialized;
}

// Test 3: Test API call directly
async function testAPICall() {
  console.log('🌐 API Call Test:');
  
  try {
    const url = new URL('/api/gallery-items-normal', window.location.origin);
    url.searchParams.set('page', '0');
    url.searchParams.set('lat', '0');
    url.searchParams.set('lon', '0');
    
    console.log('Testing API URL:', url.toString());
    
    const response = await fetch(url.toString());
    const data = await response.json();
    
    console.log('API Response:', {
      status: response.status,
      data: data,
      itemsCount: data.items?.length || 0,
      totalCount: data.totalCount
    });
    
    return data;
  } catch (error) {
    console.error('API Call Error:', error);
    return null;
  }
}

// Test 4: Check database function
async function testDatabaseFunction() {
  console.log('🗄️ Database Function Test:');
  
  try {
    const response = await fetch('/api/test-db');
    const data = await response.json();
    
    console.log('Database Test Response:', data);
    
    return data;
  } catch (error) {
    console.error('Database Test Error:', error);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running all debug tests...');
  
  const gpsCheck = checkGPSAvailability();
  const galleryCheck = checkGalleryStore();
  const apiTest = await testAPICall();
  const dbTest = await testDatabaseFunction();
  
  console.log('📊 Test Results Summary:');
  console.log('- GPS Available:', !!(gpsCheck.windowLat || gpsCheck.storedLat || gpsCheck.sessionLat));
  console.log('- Gallery Initialized:', !!galleryCheck);
  console.log('- API Working:', !!apiTest);
  console.log('- Database Working:', !!dbTest);
  
  return { gpsCheck, galleryCheck, apiTest, dbTest };
}

// Export for manual testing
window.debugGPSAndGallery = {
  checkGPSAvailability,
  checkGalleryStore,
  testAPICall,
  testDatabaseFunction,
  runAllTests
};

console.log('✅ Debug functions loaded. Run window.debugGPSAndGallery.runAllTests() to test everything.'); 