// full-debug-test.ts - Debug the entire template engine flow

import { TemplateEngine, DocumentFormat } from './index'

async function fullDebugTest() {
  console.log('🔍 Full Template Engine Debug...')
  
  try {
    const engine = new TemplateEngine()
    
    const template = '{d.items[0].name}'
    const data = {
      items: [
        { name: 'Laptop', price: 1299.99 },
        { name: 'Mouse', price: 25.99 }
      ]
    }
    
    console.log('\n1. Input:')
    console.log('Template:', template)
    console.log('Data:', JSON.stringify(data, null, 2))
    
    // Step 1: Parse template
    console.log('\n2. Parse Template:')
    const parsed = await engine.parseTemplate({
      content: template,
      format: DocumentFormat.TXT
    })
    
    console.log('Parsed tags:', JSON.stringify(parsed.tags, null, 2))
    
    // Step 2: Validate template
    console.log('\n3. Validate Template:')
    const validation = engine.validateTemplate(parsed)
    console.log('Validation result:', validation)
    
    // Step 3: Process data (this is where we might lose the data)
    console.log('\n4. Process Data:')
    
    // Let's manually access the data processor to debug
    const dataProcessor = (engine as any).processor
    const processedData = dataProcessor.process(data, parsed)
    
    console.log('Processed data computed map:')
    for (const [key, value] of processedData.computed.entries()) {
      console.log(`  ${key}: ${JSON.stringify(value)}`)
    }
    
    // Step 4: Render
    console.log('\n5. Render:')
    const renderer = (engine as any).renderer
    const rendered = renderer.render(parsed, processedData)
    
    console.log('Final result:', rendered.content.toString())
    
  } catch (error) {
    console.error('❌ Full debug test failed:', error)
    console.error('Stack trace:', error)
  }
}

// Run the test
if (require.main === module) {
  fullDebugTest()
}

export { fullDebugTest }