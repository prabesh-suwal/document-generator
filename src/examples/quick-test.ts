import { TemplateEngine } from '../engine/TemplateEngine'
import { DocumentFormat } from '../types/core'

async function quickTest() {
  console.log('⚡ Quick Template Engine Test\n')
  
  const engine = new TemplateEngine()
  
  const template = 'Hello {d.name}! Total: ${d.items[].price:aggSum()}'
  const data = {
    name: 'World',
    items: [{ price: 10 }, { price: 20 }, { price: 30 }]
  }
  
  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data
    })
    
    console.log('Template:', template)
    console.log('Data:', JSON.stringify(data))
    console.log('Result:', result.content.toString())
    console.log('\n✅ Engine is working correctly!')
    
    return true
  } catch (error) {
    console.error('❌ Engine test failed:', error instanceof Error ? error.message : 'Unknown error')
    return false
  }
}

if (require.main === module) {
  quickTest()
}

export { quickTest }