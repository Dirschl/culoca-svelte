// Test script for radius URL priority functionality
// Run this in browser console to test

// Test 1: Simulate URL with radius parameter
function testRadiusURLPriority() {
  console.log('🧪 Testing radius URL priority over localStorage...');
  
  // Set a different value in localStorage
  localStorage.setItem('radius', '1000');
  console.log('✅ Set localStorage radius to 1000m');
  
  // Simulate URL with different radius parameter
  const testURL = 'http://localhost:5173/item/example?r=2500';
  const url = new URL(testURL);
  const radiusParam = url.searchParams.get('r');
  
  console.log('✅ URL radius parameter:', radiusParam);
  
  // Parse radius from URL (should take priority)
  let finalRadius = 1000; // default
  if (radiusParam) {
    const radiusValue = parseInt(radiusParam);
    if (!isNaN(radiusValue) && radiusValue > 0) {
      finalRadius = radiusValue;
      console.log('✅ Using radius from URL parameter:', finalRadius);
    }
  } else {
    // Fallback to localStorage
    const storedRadius = Number(localStorage.getItem('radius'));
    if (!isNaN(storedRadius) && storedRadius > 0) {
      finalRadius = storedRadius;
      console.log('✅ Using radius from localStorage:', finalRadius);
    }
  }
  
  console.log('✅ Final radius value:', finalRadius);
  console.log('✅ Expected: 2500m (from URL), localStorage ignored');
  
  return finalRadius;
}

// Test 2: Simulate URL without radius parameter
function testRadiusLocalStorageFallback() {
  console.log('🧪 Testing localStorage fallback when no URL parameter...');
  
  // Set value in localStorage
  localStorage.setItem('radius', '1500');
  console.log('✅ Set localStorage radius to 1500m');
  
  // Simulate URL without radius parameter
  const testURL = 'http://localhost:5173/item/example';
  const url = new URL(testURL);
  const radiusParam = url.searchParams.get('r');
  
  console.log('✅ URL radius parameter:', radiusParam);
  
  // Parse radius (should use localStorage)
  let finalRadius = 1000; // default
  if (radiusParam) {
    const radiusValue = parseInt(radiusParam);
    if (!isNaN(radiusValue) && radiusValue > 0) {
      finalRadius = radiusValue;
      console.log('✅ Using radius from URL parameter:', finalRadius);
    }
  } else {
    // Fallback to localStorage
    const storedRadius = Number(localStorage.getItem('radius'));
    if (!isNaN(storedRadius) && storedRadius > 0) {
      finalRadius = storedRadius;
      console.log('✅ Using radius from localStorage:', finalRadius);
    }
  }
  
  console.log('✅ Final radius value:', finalRadius);
  console.log('✅ Expected: 1500m (from localStorage)');
  
  return finalRadius;
}

// Run tests
console.log('=== Test 1: URL parameter priority ===');
testRadiusURLPriority();

console.log('\n=== Test 2: localStorage fallback ===');
testRadiusLocalStorageFallback(); 