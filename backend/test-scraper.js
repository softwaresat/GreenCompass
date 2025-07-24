/**
 * Test script for the GreenCompass backend scraper
 * Run with: node test-scraper.js
 */

import { scrapeWithMinimalPlaywright } from './services/playwrightScraper.js';

const testUrls = [
  'https://www.olivegarden.com',
  'https://www.mcdonalds.com',
  'https://www.subway.com'
];

async function testScraper() {
  console.log('🧪 Testing GreenCompass Backend Scraper');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const url of testUrls) {
    console.log(`\n📋 Testing: ${url}`);
    
    try {
      const result = await scrapeWithMinimalPlaywright(url, {
        timeout: 15000,
        mobileViewport: true,
        blockResources: ['image', 'font', 'media']
      });
      
      if (result.success) {
        console.log(`✅ Success: Found ${result.menuItems?.length || 0} menu items`);
        console.log(`💰 With prices: ${result.menuItems?.filter(item => item.price).length || 0}`);
        console.log(`⚡ Time: ${result.extractionTime}ms`);
        console.log(`🔧 Method: ${result.discoveryMethod || 'direct'}`);
        
        // Show first few items
        if (result.menuItems && result.menuItems.length > 0) {
          console.log(`📝 Sample items:`);
          result.menuItems.slice(0, 3).forEach((item, i) => {
            console.log(`   ${i + 1}. ${item.name} ${item.price ? `- ${item.price}` : ''}`);
          });
        }
      } else {
        console.log(`❌ Failed: ${result.error}`);
        console.log(`⏱️  Time: ${result.extractionTime}ms`);
      }
      
    } catch (error) {
      console.log(`💥 Exception: ${error.message}`);
    }
    
    // Wait between tests to be gentle on servers
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 Test completed');
  process.exit(0);
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
  // Test specific URL
  const customUrl = args[0];
  console.log(`🧪 Testing custom URL: ${customUrl}`);
  
  scrapeWithMinimalPlaywright(customUrl, {
    timeout: 20000,
    mobileViewport: false,
    blockResources: ['image', 'font']
  })
  .then(result => {
    console.log('Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
} else {
  testScraper();
}
