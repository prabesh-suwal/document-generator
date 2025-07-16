// test-array-iteration.js - Test array iteration functionality

const { TemplateEngine } = require('./dist/handlers/DocumentArrayProcessor');
const { DocumentFormat } = require('./dist/types/core');

async function testArrayIteration() {
  console.log('🔍 Testing Array Iteration...\n');
  
  try {
const testTemplate = `
Total Amount: {d.items[].qty:mul(.price):aggSum():round(2)}
`

const testData = {
  items: [
    { qty: 10, price: 125 },     // 10 * 125 = 1250
    { qty: 1, price: 299.99 },   // 1 * 299.99 = 299.99  
    { qty: 12, price: 50 }       // 12 * 50 = 600
  ]
}


    const engine = new TemplateEngine();
    
    // Test 1: Simple array iteration
    console.log('Test 1: Simple array iteration');
    const template1 = 'Items:\n{d.items[i].name} - ${d.items[i].price}';
    const data1 = { 
      items: [
        { name: 'Laptop', price: 999 },
        { name: 'Mouse', price: 25 },
        { name: 'Keyboard', price: 75 }
      ] 
    };
    
    console.log('Template:', template1);
    console.log('Data:', JSON.stringify(data1, null, 2));
    
    const result1 = await engine.render({
      template: { 
        content: template1, 
        format: DocumentFormat.TXT 
      },
      data: data1
    });
    
    console.log('\nResult:');
    console.log(result1.content.toString());
    
    // Test 2: Array iteration with formatters
    console.log('\n' + '='.repeat(50));
    console.log('Test 2: Array iteration with formatters');
    const template2 = 'Product List:\n{d.products[i].name:upperCase} | ${d.products[i].price:round(2)} | Qty: {d.products[i].quantity}';
    const data2 = {
      products: [
        { name: 'laptop computer', price: 1299.99, quantity: 2 },
        { name: 'wireless mouse', price: 45.50, quantity: 5 },
        { name: 'mechanical keyboard', price: 125.00, quantity: 1 }
      ]
    };
    
    console.log('Template:', template2);
    console.log('Data:', JSON.stringify(data2, null, 2));
    
    const result2 = await engine.render({
      template: {
        content: template2,
        format: DocumentFormat.TXT
      },
      data: data2
    });
    
    console.log('\nResult:');
    console.log(result2.content.toString());
    
    // Test 3: Mixed content with array iteration
    console.log('\n' + '='.repeat(50));
    console.log('Test 3: Mixed content with array iteration');
    const template3 = `Invoice Report
Date: {d.date}
Customer: {d.customer.name}

Items:
{d.items[i].description} | Qty: {d.items[i].qty} | Price: \${d.items[i].price:round(2)} | Total: \${d.items[i].qty:mul(.price):round(2)}

Total Amount: \${d.items[].qty:mul(.price):aggSum():round(2)}`;

    const data3 = {
      date: '2025-01-15',
      customer: { name: 'John Doe' },
      items: [
        { description: 'Professional Services', qty: 10, price: 125.00 },
        { description: 'Software License', qty: 1, price: 299.99 },
        { description: 'Support Package', qty: 12, price: 50.00 }
      ]
    };
    
    console.log('Template:');
    console.log(template3);
    console.log('\nData:', JSON.stringify(data3, null, 2));
    
    const result3 = await engine.render({
      template: {
        content: template3,
        format: DocumentFormat.TXT
      },
      data: data3
    });
    
    console.log('\nResult:');
    console.log(result3.content.toString());
    
    console.log('\n🎉 Array iteration tests completed!');
    
  } catch (error) {
    console.error('❌ Array iteration test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testArrayIteration();