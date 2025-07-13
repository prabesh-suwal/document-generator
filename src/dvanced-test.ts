
// import { TemplateEngine, DocumentFormat } from './index'

// async function advancedTest() {
//   console.log('🔬 Testing Advanced Template Engine Features...')
  
//   try {
//     const engine = new TemplateEngine()
    
//     // Test: Mathematical operations with dynamic parameters
//     // This will work once we implement proper dynamic parameter resolution
//     console.log('\n🧮 Test: Dynamic mathematical operations (Future feature)')
//     console.log('Template: {d.qty:mul(.price):round(2)}')
//     console.log('Current Status: Requires Phase 2 implementation')
    
//     // Test: Array processing
//     console.log('\n📊 Test: Array processing (Future feature)')
//     console.log('Template: {d.items[].name} - {d.items[].price:aggSum()}')
//     console.log('Current Status: Requires Phase 2 implementation')
    
//     // Test: Conditional arrays
//     console.log('\n🎯 Test: Array filtering (Future feature)')
//     console.log('Template: {d.users[active=true].name}')
//     console.log('Current Status: Requires Phase 2 implementation')
    
//     // What currently works
//     console.log('\n✅ Currently Working Features:')
//     console.log('- Basic data injection: {d.property}')
//     console.log('- Text formatters: {d.name:upperCase:trim}')
//     console.log('- Simple math: {d.value:add(10):mul(2)}')
//     console.log('- Conditionals: {d.active:ifTrue("Yes", "No")}')
    
//     // Show a working complex example
//     console.log('\n📝 Working Complex Example:')
//     const workingTemplate = `
// Product Catalog
// ===============

// Product: {d.name:ucFirst}
// Price: ${d.price:round(2)}
// Discounted: ${d.price:mul(0.9):round(2)}
// Category: {d.category:upperCase}
// Available: {d.inStock:ifTrue("✓ In Stock", "✗ Out of Stock")}
// Rating: {d.rating:round(1)}/5.0

// Description: {d.description:substr(0, 100)}...
//     `.trim()
    
//     const result = await engine.render({
//       template: {
//         content: workingTemplate,
//         format: DocumentFormat.TXT
//       },
//       data: {
//         name: 'wireless headphones',
//         price: 149.99,
//         category: 'electronics',
//         inStock: true,
//         rating: 4.7,
//         description: 'High-quality wireless headphones with noise cancellation and premium sound quality. Perfect for music lovers and professionals who need crystal clear audio.'
//       }
//     })
    
//     console.log('Result:')
//     console.log(result.content.toString())
    
//     console.log('\n🎯 Next Development Priorities:')
//     console.log('1. Dynamic parameter resolution for math operations')
//     console.log('2. Array processing and iteration')
//     console.log('3. Aggregation functions (sum, avg, count)')
//     console.log('4. Document format handlers (DOCX, PDF)')
//     console.log('5. Template caching and performance optimization')
    
//   } catch (error) {
//     console.error('❌ Advanced test failed:', error)
//   }
// }

// // Run the test
// if (require.main === module) {
//   advancedTest()
// }

// export { advancedTest }