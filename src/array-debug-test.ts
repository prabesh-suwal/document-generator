
import { TemplateEngine, DocumentFormat } from './index'

async function arrayDebugTest() {
  console.log('🔍 Array Access Debug Test...')
  
  try {
    const engine = new TemplateEngine()
    
    const data = {
      items: [
        { name: 'Laptop', price: 1299.99 },
        { name: 'Mouse', price: 25.99 }
      ]
    }
    
    // Test 1: Direct property access
    console.log('\n1. Direct property access')
    const result1 = await engine.render({
      template: {
        content: 'Items length: {d.items:aggCount()}',
        format: DocumentFormat.TXT
      },
      data
    })
    console.log('Result:', result1.content.toString())
    
    // Test 2: Simple array index
    console.log('\n2. Simple array index')
    const result2 = await engine.render({
      template: {
        content: 'First item exists: {d.items[0]}',
        format: DocumentFormat.TXT
      },
      data
    })
    console.log('Result:', result2.content.toString())
    
    // Test 3: Array index with property
    console.log('\n3. Array index with property')
    const result3 = await engine.render({
      template: {
        content: 'First item name: {d.items[0].name}',
        format: DocumentFormat.TXT
      },
      data
    })
    console.log('Result:', result3.content.toString())
    
    // Test 4: Multiple properties
    console.log('\n4. Multiple properties')
    const result4 = await engine.render({
      template: {
        content: 'Item: {d.items[0].name} - ${d.items[0].price}',
        format: DocumentFormat.TXT
      },
      data
    })
    console.log('Result:', result4.content.toString())
    
    // Debug: Let's see what the parser extracts
    console.log('\n5. Parser debug')
    const parsed = await engine.parseTemplate({
      content: '{d.items[0].name}',
      format: DocumentFormat.TXT
    })
    console.log('Parsed tags:', JSON.stringify(parsed.tags, null, 2))
    
  } catch (error) {
    console.error('❌ Array debug test failed:', error)
  }
}

// Run the test
if (require.main === module) {
  arrayDebugTest()
}

export { arrayDebugTest }