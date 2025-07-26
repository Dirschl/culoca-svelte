// Test script for radius URL functionality
// Run this in browser console to test

// Test 1: Set radius and check URL
function testRadiusURL() {
  console.log('🧪 Testing radius URL functionality...');
  
  // Simulate setting radius
  localStorage.setItem('radius', '2000');
  
  // Create mock filterStore state
  const mockState = {
    userFilter: null,
    locationFilter: null,
    lastGpsPosition: null,
    gpsAvailable: false,
    referrerAccount: null
  };
  
  // Test URL update function
  const url = new URL(window.location.href);
  const params = url.searchParams;
  
  // Clear existing params
  params.delete('user');
  params.delete('account');
  params.delete('lat');
  params.delete('lon');
  params.delete('location');
  params.delete('r');
  
  // Add radius parameter
  const storedRadius = localStorage.getItem('radius');
  if (storedRadius) {
    const radiusValue = parseInt(storedRadius);
    if (!isNaN(radiusValue) && radiusValue > 0) {
      params.set('r', radiusValue.toString());
    }
  }
  
  console.log('✅ URL with radius parameter:', url.toString());
  console.log('✅ Radius value from localStorage:', storedRadius);
  
  return url.toString();
}

// Test 2: Parse radius from URL
function testRadiusFromURL() {
  console.log('🧪 Testing radius parsing from URL...');
  
  // Simulate URL with radius parameter
  const testURL = 'https://example.com?r=2000&user=test';
  const url = new URL(testURL);
  const radiusParam = url.searchParams.get('r');
  
  console.log('✅ Radius parameter from URL:', radiusParam);
  
  if (radiusParam) {
    const radiusValue = parseInt(radiusParam);
    if (!isNaN(radiusValue) && radiusValue > 0) {
      localStorage.setItem('radius', radiusValue.toString());
      console.log('✅ Radius stored in localStorage:', radiusValue);
    }
  }
}

// Run tests
testRadiusURL();
testRadiusFromURL(); 