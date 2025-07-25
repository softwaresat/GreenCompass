/**
 * Test script for PDF menu parsing
 * Run with: node test-pdf-parser.js [pdf-url]
 */

const pdfParser = require('./services/pdfParser');

const testPdfUrls = [
  // Add some example PDF menu URLs for testing
  'https://example-restaurant.com/menu.pdf',
  // You can add actual PDF menu URLs here for testing
];

async function testPDFParser() {
  console.log('📄 Testing GreenCompass PDF Menu Parser');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Check if custom URL provided
  const args = process.argv.slice(2);
  const urlsToTest = args.length > 0 ? [args[0]] : testPdfUrls;
  
  if (urlsToTest.length === 0) {
    console.log('❓ No PDF URLs provided to test.');
    console.log('Usage: node test-pdf-parser.js <pdf-url>');
    console.log('Example: node test-pdf-parser.js https://restaurant.com/menu.pdf');
    process.exit(0);
  }
  
  for (const url of urlsToTest) {
    console.log(`\n📋 Testing PDF: ${url}`);
    
    try {
      const startTime = Date.now();
      const result = await pdfParser.parsePDFMenu(url);
      const endTime = Date.now();
      
      if (result.success) {
        console.log(`✅ Success: Found ${result.menuItems?.length || 0} menu items`);
        console.log(`📊 Categories: ${result.categories?.length || 0}`);
        console.log(`💰 With prices: ${result.menuItems?.filter(item => item.price && item.price !== '').length || 0}`);
        console.log(`⚡ Time: ${endTime - startTime}ms`);
        console.log(`🔧 Method: ${result.discoveryMethod || 'pdf-parsing'}`);
        
        // Show restaurant info if found
        if (result.restaurantInfo && result.restaurantInfo.name) {
          console.log(`🏪 Restaurant: ${result.restaurantInfo.name}`);
        }
        
        // Show categories
        if (result.categories && result.categories.length > 0) {
          console.log(`📝 Categories: ${result.categories.join(', ')}`);
        }
        
        // Show first few items
        if (result.menuItems && result.menuItems.length > 0) {
          console.log(`🍽️  Sample items:`);
          result.menuItems.slice(0, 5).forEach((item, i) => {
            const price = item.price ? ` - ${item.price}` : '';
            const category = item.category ? ` (${item.category})` : '';
            console.log(`   ${i + 1}. ${item.name}${price}${category}`);
            if (item.description && item.description.length > 0) {
              console.log(`      ${item.description.substring(0, 80)}${item.description.length > 80 ? '...' : ''}`);
            }
          });
        }
        
        // Show raw text sample for debugging
        if (result.rawText && result.rawText.length > 0) {
          console.log(`\n📄 Raw text sample (first 200 chars):`);
          console.log(`"${result.rawText.substring(0, 200)}..."`);
        }
        
      } else {
        console.log(`❌ Failed: ${result.error}`);
        console.log(`⏱️  Time: ${endTime - startTime}ms`);
      }
      
    } catch (error) {
      console.log(`💥 Exception: ${error.message}`);
    }
    
    // Wait between tests
    if (urlsToTest.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n🏁 PDF parsing test completed');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  process.exit(0);
});

testPDFParser();
