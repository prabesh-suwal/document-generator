// test-agg-debug.js - Debug the exact aggregation issue

const { TemplateEngine } = require('./dist/handlers/DocumentArrayProcessor');
const { DocumentFormat } = require('./dist/types/core');

async function debugAggregation() {
  console.log('🔍 Debugging Array Aggregation Issue...\n');
  
  try {
    const engine = new TemplateEngine();
    
    // This is the exact test case that's failing
    const template = '{d.numbers[].value:aggSum()}';
    const data = { 
      numbers: [
        { value: 10 }, 
        { value: 20 }, 
        { value: 30 }
      ] 
    };
    
    console.log('1. Test Data:');
    console.log('Template:', template);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    // Parse template to see the structure
    console.log('\n2. Parsing template...');
    const parsed = await engine.parseTemplate({
      content: template,
      format: DocumentFormat.TXT
    });
    
    console.log('Parsed tags:');
    parsed.tags.forEach((tag, i) => {
      console.log(`  Tag ${i}:`, {
        raw: tag.raw,
        path: tag.path,
        arrayPath: tag.arrayPath,
        formatters: tag.formatters.map(f => ({ name: f.name, params: f.parameters }))
      });
    });
    
    // Test manual array access
    console.log('\n3. Manual array access test:');
    console.log('data.numbers:', data.numbers);
    console.log('data.numbers[0].value:', data.numbers[0].value);
    console.log('Manual sum:', data.numbers.reduce((sum, item) => sum + item.value, 0));
    
    // Process data
    console.log('\n4. Processing data (with debug logs)...');
    const processor = engine.processor;
    const processedData = processor.process(data, parsed);
    
    console.log('\n5. Processed results:');
    console.log('Computed values:');
    for (const [key, value] of processedData.computed.entries()) {
      console.log(`  ${key}: ${value} (${typeof value})`);
    }
    
    console.log('Aggregations:');
    for (const [key, value] of processedData.aggregations.entries()) {
      console.log(`  ${key}: ${value} (${typeof value})`);
    }
    
    // Final render
    console.log('\n6. Final render...');
    const result = await engine.render({
      template: {
        content: template,
        format: DocumentFormat.TXT
      },
      data: data
    });
    
    console.log('Final result:', `"${result.content.toString()}"`);
    console.log('Expected: "60"');
    console.log('Match:', result.content.toString() === '60' ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugAggregation();