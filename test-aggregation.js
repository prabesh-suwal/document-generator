// test-aggregation.js - Debug array aggregation specifically

const { TemplateEngine } = require('./dist/handlers/DocumentArrayProcessor');
const { DocumentFormat } = require('./dist/types/core');

async function testAggregation() {
  console.log('🔍 Debugging Array Aggregation...\n');
  
  try {
    const engine = new TemplateEngine();
    
    const template = '{d.numbers[].value:aggSum()}';
    const data = { 
      numbers: [
        { value: 10 }, 
        { value: 20 }, 
        { value: 30 }
      ] 
    };
    
    console.log('1. Input:');
    console.log('  Template:', template);
    console.log('  Data:', JSON.stringify(data, null, 2));
    
    // Parse template
    const parsed = await engine.parseTemplate({
      content: template,
      format: DocumentFormat.TXT
    });
    
    console.log('\n2. Parsed tags:');
    parsed.tags.forEach((tag, i) => {
      console.log(`  Tag ${i}:`, {
        raw: tag.raw,
        path: tag.path,
        arrayPath: tag.arrayPath,
        formatters: tag.formatters
      });
    });
    
    // Process data
    const processor = engine.processor;
    const processedData = processor.process(data, parsed);
    
    console.log('\n3. Processed data:');
    console.log('  Computed values:');
    for (const [key, value] of processedData.computed.entries()) {
      console.log(`    ${key}: ${value} (${typeof value})`);
    }
    
    console.log('  Aggregations:');
    for (const [key, value] of processedData.aggregations.entries()) {
      console.log(`    ${key}: ${value} (${typeof value})`);
    }
    
    // Manual aggregation test
    console.log('\n4. Manual aggregation test:');
    const values = data.numbers.map(n => n.value);
    console.log('  Values array:', values);
    console.log('  Manual sum:', values.reduce((sum, val) => sum + val, 0));
    
    // Render
    const result = await engine.render({
      template: {
        content: template,
        format: DocumentFormat.TXT
      },
      data: data
    });
    
    console.log('\n5. Final result:', `"${result.content.toString()}"`);
    console.log('   Expected: "60"');
    console.log('   Match:', result.content.toString() === '60' ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Aggregation test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAggregation();