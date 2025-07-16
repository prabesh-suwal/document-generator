import { TemplateEngine } from '../engine/TemplateEngine'
import { DocumentFormat } from '../types/core'

/**
 * Test specifically for the array aggregation bug fix
 */
export async function testArrayAggregationFix() {
  console.log('🔍 Testing Array Aggregation Fix\n')
  
  const engine = new TemplateEngine()
  
  // FIXED: Use string concatenation instead of template literals to avoid TypeScript conflicts
  const template = [
    'Invoice Report',
    '==============',
    'Date: {d.date}',
    'Customer: {d.customer.name}',
    '',
    'Items:',
    '{d.items[i].description} | Qty: {d.items[i].qty} | Price: $' + '{d.items[i].price:round(2)} | Total: $' + '{d.items[i].qty:mul(.price):round(2)}',
    '',
    'Calculations:',
    '- Item Count: {d.items[].description:aggCount()}',
    '- Total Quantity: {d.items[].qty:aggSum()}',
    '- Total Amount: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}',
    '- Average Item Price: $' + '{d.items[].price:aggAvg():round(2)}',
    '- Most Expensive Item: $' + '{d.items[].price:aggMax()}'
  ].join('\n')

  const data = {
    date: "2025-01-15",
    customer: {
      name: "John Doe"
    },
    items: [
      { description: "Professional Services", qty: 10, price: 125 },
      { description: "Software License", qty: 1, price: 299.99 },
      { description: "Support Package", qty: 12, price: 50 }
    ]
  }

  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data
    })
    
    console.log('✅ Result:')
    console.log(result.content.toString())
    
    console.log('\n🎯 Expected Calculations:')
    console.log('- Item Count: 3')
    console.log('- Total Quantity: 23 (10+1+12)')
    console.log('- Total Amount: $2149.99 (1250+299.99+600)')
    console.log('- Average Item Price: $158.33 ((125+299.99+50)/3)')
    console.log('- Most Expensive Item: $299.99')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

if (require.main === module) {
  testArrayAggregationFix().catch(console.error)
}
