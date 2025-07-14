// Create this as test-integration.js

const { TemplateEngine } = require('./dist/handlers/DocumentArrayProcessor');
const { DocumentFormat } = require('./dist/types/core');

async function runIntegrationTests() {
  console.log('🧪 Running Integration Tests...\n');
  
  const testSuites = [
    {
      name: 'Formatter Chain Test',
      template: '{d.text:lowerCase:trim:ucFirst}',
      data: { text: '  HELLO WORLD  ' },
      expected: 'Hello world'
    },
    {
      name: 'Dynamic Parameter Test',
      template: '{d.quantity:mul(.price):round(2)}',
      data: { quantity: 3, price: 29.99 },
      expected: '89.97'
    },
    {
      name: 'Array Aggregation Test',
      template: '{d.numbers[].value:aggSum()}',
      data: { numbers: [{ value: 10 }, { value: 20 }, { value: 30 }] },
      expected: '60'
    },
    {
      name: 'Complex Conditional Test',
      template: '{d.status:eq("active"):ifTrue("✅ Active", "❌ Inactive")}',
      data: { status: 'active' },
      expected: '✅ Active'
    },
    {
      name: 'Nested Data Access Test',
      template: '{d.user.profile.settings.theme:upperCase}',
      data: { 
        user: { 
          profile: { 
            settings: { 
              theme: 'dark' 
            } 
          } 
        } 
      },
      expected: 'DARK'
    }
  ];
  
  const engine = new TemplateEngine();
  let passed = 0;
  let failed = 0;
  
  for (const test of testSuites) {
    try {
      console.log(`🔬 Running: ${test.name}`);
      
      const result = await engine.render({
        template: {
          content: test.template,
          format: DocumentFormat.TXT
        },
        data: test.data
      });
      
      const output = result.content.toString().trim();
      
      if (output === test.expected) {
        console.log(`   ✅ PASS - Got: "${output}"`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - Expected: "${test.expected}", Got: "${output}"`);
        failed++;
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR - ${error.message}`);
      failed++;
    }
    
    console.log('');
  }
  
  console.log('📊 Integration Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All integration tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the implementation.');
  }
  
  return { passed, failed };
}

runIntegrationTests();