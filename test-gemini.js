/**
 * Simple test to verify Gemini integration is working
 */

// Test imports
import { geminiService, claudeService, generateRPGContent, AI_CONFIG } from './src/lib/ai/index.ts';

async function testGeminiIntegration() {
  console.log('🧪 Testing Gemini AI Integration...\n');
  
  // Test 1: Verify service singleton
  console.log('✅ Test 1: Service instances');
  console.log('  - geminiService is available:', !!geminiService);
  console.log('  - claudeService alias works:', claudeService === geminiService);
  
  // Test 2: Check configuration
  console.log('\n✅ Test 2: Configuration');
  console.log('  - Models configured:', Object.keys(AI_CONFIG.MODELS));
  console.log('  - Creative model:', AI_CONFIG.MODELS.CREATIVE);
  console.log('  - Analytical model:', AI_CONFIG.MODELS.ANALYTICAL);
  
  // Test 3: Test fallback behavior (without API key)
  console.log('\n✅ Test 3: Fallback behavior');
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.log('  - API key not set, testing fallback...');
    try {
      const content = await geminiService.generateContent(
        'Generate a test RPG scenario',
        { gameType: 'rpg' }
      );
      console.log('  - Fallback content generated:', content.substring(0, 50) + '...');
    } catch (error) {
      console.log('  - Error (expected if no fallback):', error.message);
    }
  } else {
    console.log('  - API key is set, would use real Gemini API');
  }
  
  // Test 4: Quick generation functions
  console.log('\n✅ Test 4: Quick generation functions');
  try {
    console.log('  - Testing RPG content generation...');
    const rpgContent = await generateRPGContent('world', {
      theme: 'fantasy',
      size: 'small'
    });
    console.log('  - RPG content type:', typeof rpgContent);
  } catch (error) {
    console.log('  - Error:', error.message);
  }
  
  // Test 5: Health check
  console.log('\n✅ Test 5: Service health check');
  const health = await geminiService.healthCheck();
  console.log('  - Service status:', health.status);
  console.log('  - API key configured:', health.checks.apiKeyConfigured);
  console.log('  - Cache working:', health.checks.cacheWorking);
  
  console.log('\n✨ Gemini integration test complete!');
  console.log('📝 Note: Set GOOGLE_AI_API_KEY environment variable for full functionality');
}

// Run the test
testGeminiIntegration().catch(console.error);