// test-debug.js - Diagnostic test to see exactly what's happening

const { TemplateEngine } = require('./dist/handlers/DocumentArrayProcessor');
const { DocumentFormat } = require('./dist/types/core');

async function diagnosticTest() {
  console.log('🔍 Diagnostic Test - Tracing the Issue...\n');
  
  try {
    const engine = new TemplateEngine();
    
    // Simple test case
    const template = 'Hello {d.name}!';
    const data = { name: 'World' };
    
    console.log('1. Input:');
    console.log('  Template:', template);
    console.log('  Data:', JSON.stringify(data));
    
    // Parse template
    console.log('\n2. Parsing template...');
    const parsed = await engine.parseTemplate({
      content: template,
      format: DocumentFormat.TXT
    });
    
    console.log('  Parsed tags:');
    parsed.tags.forEach((tag, i) => {
      console.log(`    Tag ${i}: ${JSON.stringify({
        id: tag.id,
        raw: tag.raw,
        path: tag.path,
        formatters: tag.formatters
      }, null, 2)}`);
    });
    
    // Process data
    console.log('\n3. Processing data...');
    const processor = engine.processor;
    const processedData = processor.process(data, parsed);
    
    console.log('  Computed values:');
    for (const [key, value] of processedData.computed.entries()) {
      console.log(`    ${key}: "${value}"`);
    }
    
    // Render
    console.log('\n4. Rendering...');
    const renderer = engine.renderer;
    const rendered = renderer.render(parsed, processedData);
    
    console.log('  Final result:', `"${rendered.content.toString()}"`);
    
    // Compare expected vs actual
    console.log('\n5. Analysis:');
    const expected = 'Hello World!';
    const actual = rendered.content.toString();
    
    console.log(`  Expected: "${expected}"`);
    console.log(`  Actual:   "${actual}"`);
    console.log(`  Match:    ${expected === actual ? '✅' : '❌'}`);
    
    if (expected !== actual) {
      console.log('\n❌ Issue detected! The tag is not being properly replaced.');
      console.log('This suggests the renderer is not finding/replacing the tags correctly.');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

diagnosticTest();