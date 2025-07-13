
// debug-test.ts - Debug array processing
import { TemplateEngine, DocumentFormat } from './index'

async function debugTest() {
  console.log('🔍 Debug Testing...')
  
  try {
    const engine = new TemplateEngine()
    
    // Test 1: Simple math with dynamic parameters
    console.log('\n🧮 Test 1: Dynamic math parameters')
    const result1 = await engine.render({
      template: {
        content: 'Quantity: {d.quantity}, Price: {d.price}, Total: {d.quantity:mul(.price):round(2)}',
        format: DocumentFormat.TXT
      },
      data: {
        quantity: 2,
        price: 999.99
      }
    })
    console.log('Result:', result1.content.toString())
    console.log('Expected: Total should be 1999.98')
    
    // Test 2: Simple array access (no iteration yet)
    console.log('\n📋 Test 2: Simple array access')
    const result2 = await engine.render({
      template: {
        content: 'First item: {d.items[0].name}, Price: {d.items[0].price}',
        format: DocumentFormat.TXT
      },
      data: {
        items: [
          { name: 'Laptop', price: 1299.99 },
          { name: 'Mouse', price: 25.99 }
        ]
      }
    })
    console.log('Result:', result2.content.toString())
    
    // Test 3: Array aggregation
    console.log('\n📊 Test 3: Array aggregation')
    const result3 = await engine.render({
      template: {
        content: 'Items count: {d.items:aggCount()}, Total prices: {d.prices:aggSum()}',
        format: DocumentFormat.TXT
      },
      data: {
        items: ['Laptop', 'Mouse', 'Keyboard'],
        prices: [1299.99, 25.99, 79.99]
      }
    })
    console.log('Result:', result3.content.toString())
    
  } catch (error) {
    console.error('❌ Debug test failed:', error)
  }
}

// Run the test
if (require.main === module) {
  debugTest()
}

export { debugTest }