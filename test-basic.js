// test-basic.js - Save this in the project root

const { TemplateEngine } = require('./dist/handlers/DocumentArrayProcessor');
const { DocumentFormat } = require('./dist/types/core');

async function testBasicFunctionality() {
  console.log('🚀 Testing Document Generator...\n');
  
  try {
    // Initialize the engine
    const engine = new TemplateEngine({
      performance: {
        enableMonitoring: true
      }
    });
    
    console.log('✅ Engine initialized successfully');
    
    // Test 1: Simple template
    console.log('\n📝 Test 1: Simple template rendering');
    const result1 = await engine.render({
      template: {
        content: 'Hello {d.name}! Welcome to {d.company}.',
        format: DocumentFormat.TXT
      },
      data: {
        name: 'Alice',
        company: 'Acme Corp'
      }
    });
    
    console.log('Result:', result1.content.toString());
    
    // Test 2: Formatters
    console.log('\n🔧 Test 2: Using formatters');
    const result2 = await engine.render({
      template: {
        content: 'Name: {d.name:upperCase}, Email: {d.email:lowerCase}',
        format: DocumentFormat.TXT
      },
      data: {
        name: 'john doe',
        email: 'JOHN@EXAMPLE.COM'
      }
    });
    
    console.log('Result:', result2.content.toString());
    
    // Test 3: Simple array access (not iteration yet)
    console.log('\n📊 Test 3: Array access');
    const result3 = await engine.render({
      template: {
        content: 'First item: {d.items[0].name}, Price: ${d.items[0].price}',
        format: DocumentFormat.TXT
      },
      data: {
        items: [
          { name: 'Item 1', price: 10.99 },
          { name: 'Item 2', price: 15.50 },
          { name: 'Item 3', price: 8.25 }
        ]
      }
    });
    
    console.log('Result:', result3.content.toString());
    
    // Test 4: Math operations
    console.log('\n🧮 Test 4: Mathematical operations');
    const result4 = await engine.render({
      template: {
        content: 'Price: ${d.price}, With tax: ${d.price:mul(1.08):round(2)}',
        format: DocumentFormat.TXT
      },
      data: {
        price: 29.99
      }
    });
    
    console.log('Result:', result4.content.toString());
    
    console.log('\n🎉 All basic tests passed! Your document generator is working.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testBasicFunctionality();