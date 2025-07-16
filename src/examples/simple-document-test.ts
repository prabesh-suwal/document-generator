import { TemplateEngine } from '../engine/TemplateEngine'
import { DocumentFormat } from '../types/core'
import { promises as fs } from 'fs'
import path from 'path'

export async function simpleDocumentTest() {
  console.log('🔧 Simple Document Generation Test\n')
  
  const engine = new TemplateEngine()
  
  // Create output directory
  const outputDir = path.join(process.cwd(), 'output')
  await fs.mkdir(outputDir, { recursive: true })
  console.log(`📁 Output directory: ${outputDir}`)
  
  // Test data
  const data = {
    customerName: "John Smith",
    date: "2025-01-15",
    orderNumber: "ORD-001",
    items: [
      { name: "Laptop Computer", qty: 1, price: 999.99 },
      { name: "Wireless Mouse", qty: 2, price: 29.99 },
      { name: "USB Cable", qty: 3, price: 12.50 }
    ]
  }
  
  console.log('📋 Test Data:')
  console.log(`   Customer: ${data.customerName}`)
  console.log(`   Items: ${data.items.length}`)
  console.log(`   Order: ${data.orderNumber}\n`)
  
  // Test 1: Basic template
  await basicTemplateTest(engine, data, outputDir)
  
  // Test 2: Invoice template
  await invoiceTemplateTest(engine, data, outputDir)
  
  // Test 3: HTML template
  await htmlTemplateTest(engine, data, outputDir)
}

async function basicTemplateTest(engine: TemplateEngine, data: any, outputDir: string) {
  console.log('1. Basic Template Test')
  console.log('======================')
  
  const template = [
    'Order Summary for {d.customerName}',
    'Date: {d.date}',
    'Order #: {d.orderNumber}',
    '',
    'Items:',
    '{d.items[i].name} - Qty: {d.items[i].qty} @ $' + '{d.items[i].price} = $' + '{d.items[i].qty:mul(.price):round(2)}',
    '',
    'Summary:',
    'Total Items: {d.items[].name:aggCount()}',
    'Total Amount: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}'
  ].join('\n')
  
  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data
    })
    
    const outputPath = path.join(outputDir, 'basic-order.txt')
    await fs.writeFile(outputPath, result.content)
    
    console.log('✅ Basic template generated')
    console.log(`   File: ${outputPath}`)
    console.log(`   Size: ${result.content.length} bytes`)
    
    // Show preview
    const lines = result.content.toString().split('\n')
    console.log('   Preview:')
    lines.slice(0, 8).forEach(line => console.log(`   ${line}`))
    console.log('')
    
  } catch (error) {
    console.error('❌ Basic template failed:', error instanceof Error ? error.message : 'Unknown error')
  }
}

async function invoiceTemplateTest(engine: TemplateEngine, data: any, outputDir: string) {
  console.log('2. Professional Invoice Test')
  console.log('=============================')
  
  const template = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║                        PROFESSIONAL INVOICE                 ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    'Customer: {d.customerName}',
    'Date: {d.date}',
    'Order Number: {d.orderNumber}',
    '',
    '┌─────────────────────────────────────────────────────────────┐',
    '│                        ORDER DETAILS                       │',
    '└─────────────────────────────────────────────────────────────┘',
    '',
    'Item: {d.items[i].name}',
    '  • Quantity: {d.items[i].qty}',
    '  • Unit Price: $' + '{d.items[i].price:round(2)}',
    '  • Line Total: $' + '{d.items[i].qty:mul(.price):round(2)}',
    '',
    '┌─────────────────────────────────────────────────────────────┐',
    '│                         SUMMARY                             │',
    '└─────────────────────────────────────────────────────────────┘',
    '',
    'Total Items Ordered: {d.items[].name:aggCount()}',
    'Total Quantity: {d.items[].qty:aggSum()}',
    'Average Item Price: $' + '{d.items[].price:aggAvg():round(2)}',
    'Most Expensive Item: $' + '{d.items[].price:aggMax():round(2)}',
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║  TOTAL AMOUNT DUE: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}' + '                                    ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    'Thank you for your business, {d.customerName}!'
  ].join('\n')
  
  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data
    })
    
    const outputPath = path.join(outputDir, 'professional-invoice.txt')
    await fs.writeFile(outputPath, result.content)
    
    console.log('✅ Professional invoice generated')
    console.log(`   File: ${outputPath}`)
    console.log(`   Size: ${result.content.length} bytes`)
    console.log('   Features: Borders, sections, calculations ✅\n')
    
  } catch (error) {
    console.error('❌ Professional invoice failed:', error instanceof Error ? error.message : 'Unknown error')
  }
}

async function htmlTemplateTest(engine: TemplateEngine, data: any, outputDir: string) {
  console.log('3. HTML Template Test')
  console.log('=====================')
  
  let template = '<!DOCTYPE html>\n'
  template += '<html>\n'
  template += '<head>\n'
  template += '  <title>Order for {d.customerName}</title>\n'
  template += '  <style>\n'
  template += '    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }\n'
  template += '    .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }\n'
  template += '    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }\n'
  template += '    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }\n'
  template += '    .order-info { background: #ecf0f1; padding: 15px; border-radius: 5px; }\n'
  template += '    .item { background: #f8f9fa; margin: 10px 0; padding: 15px; border-left: 4px solid #3498db; }\n'
  template += '    .item h3 { margin: 0 0 10px 0; color: #2c3e50; }\n'
  template += '    .item-details { display: flex; justify-content: space-between; }\n'
  template += '    .summary { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-top: 30px; }\n'
  template += '    .total { font-size: 24px; font-weight: bold; text-align: center; }\n'
  template += '  </style>\n'
  template += '</head>\n'
  template += '<body>\n'
  template += '  <div class="container">\n'
  template += '    <h1>Order Confirmation</h1>\n'
  template += '    \n'
  template += '    <div class="header">\n'
  template += '      <div>\n'
  template += '        <h2>Customer: {d.customerName}</h2>\n'
  template += '      </div>\n'
  template += '      <div class="order-info">\n'
  template += '        <strong>Order #:</strong> {d.orderNumber}<br>\n'
  template += '        <strong>Date:</strong> {d.date}\n'
  template += '      </div>\n'
  template += '    </div>\n'
  template += '    \n'
  template += '    <h3>Items Ordered:</h3>\n'
  template += '    \n'
  template += '    <div class="item">\n'
  template += '      <h3>{d.items[i].name}</h3>\n'
  template += '      <div class="item-details">\n'
  template += '        <span>Quantity: <strong>{d.items[i].qty}</strong></span>\n'
  template += '        <span>Price: <strong>$' + '{d.items[i].price:round(2)}</strong></span>\n'
  template += '        <span>Total: <strong>$' + '{d.items[i].qty:mul(.price):round(2)}</strong></span>\n'
  template += '      </div>\n'
  template += '    </div>\n'
  template += '    \n'
  template += '    <div class="summary">\n'
  template += '      <h3>Order Summary</h3>\n'
  template += '      <p>Total Items: {d.items[].name:aggCount()}</p>\n'
  template += '      <p>Total Quantity: {d.items[].qty:aggSum()}</p>\n'
  template += '      <div class="total">\n'
  template += '        Total Amount: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}\n'
  template += '      </div>\n'
  template += '    </div>\n'
  template += '    \n'
  template += '    <p style="text-align: center; margin-top: 30px; color: #7f8c8d;">\n'
  template += '      Thank you for your order, {d.customerName}!\n'
  template += '    </p>\n'
  template += '  </div>\n'
  template += '</body>\n'
  template += '</html>'
  
  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.HTML },
      data
    })
    
    const outputPath = path.join(outputDir, 'order-confirmation.html')
    await fs.writeFile(outputPath, result.content)
    
    console.log('✅ HTML template generated')
    console.log(`   File: ${outputPath}`)
    console.log(`   Size: ${result.content.length} bytes`)
    console.log('   Open in browser to view styled page ✅\n')
    
  } catch (error) {
    console.error('❌ HTML template failed:', error instanceof Error ? error.message : 'Unknown error')
  }
}

if (require.main === module) {
  simpleDocumentTest().catch(console.error)
}