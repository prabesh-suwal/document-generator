// ================================================================
// FIXED: src/examples/document-format-examples.ts
// ================================================================

import { TemplateEngine } from '../engine/TemplateEngine'
import { DocumentFormat } from '../types/core'
import { promises as fs } from 'fs'
import path from 'path'

export async function documentFormatExamples() {
  console.log('🔍 Testing Document Format Examples\n')
  
  const engine = new TemplateEngine()
  
  // Sample data
  const invoiceData = {
    date: "2025-01-15",
    invoiceNumber: "INV-2025-001",
    customer: {
      name: "John Doe",
      email: "john@example.com", 
      address: "123 Main Street, Anytown, ST 12345"
    },
    items: [
      { description: "Professional Consulting", qty: 8, price: 150.00 },
      { description: "Software License", qty: 1, price: 299.99 },
      { description: "Support Package", qty: 6, price: 75.50 }
    ],
    company: {
      name: "Your Company Inc.",
      address: "456 Business Ave, Suite 100, Business City, ST 67890",
      phone: "(555) 123-4567",
      email: "billing@yourcompany.com"
    }
  }

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'output')
  try {
    await fs.mkdir(outputDir, { recursive: true })
    console.log(`📁 Created output directory: ${outputDir}`)
  } catch (error) {
    console.log(`📁 Output directory already exists: ${outputDir}`)
  }

  console.log('📊 Sample Data:')
  console.log(`- Customer: ${invoiceData.customer.name}`)
  console.log(`- Items: ${invoiceData.items.length}`)
  const total = invoiceData.items.map(i => i.qty * i.price).reduce((a, b) => a + b, 0)
  console.log(`- Total: $${total.toFixed(2)}\n`)

  // Test 1: Simple text template
  await testSimpleTextTemplate(engine, invoiceData, outputDir)
  
  // Test 2: HTML template  
  await testHtmlTemplate(engine, invoiceData, outputDir)
  
  // Test 3: Enhanced template with all features
  await testEnhancedTemplate(engine, invoiceData, outputDir)

  console.log('🎉 All document format tests completed!')
  console.log(`📁 Check the 'output' directory for generated files`)
}

async function testSimpleTextTemplate(engine: TemplateEngine, data: any, outputDir: string) {
  console.log('1. Testing Simple Text Template')
  console.log('================================')
  
  const textTemplate = [
    '{d.company.name}',
    'INVOICE #{d.invoiceNumber}',
    'Date: {d.date}',
    '',
    'BILL TO:',
    '{d.customer.name}',
    '{d.customer.email}',
    '{d.customer.address}',
    '',
    'ITEMS:',
    '{d.items[i].description} | Qty: {d.items[i].qty} | Price: $' + '{d.items[i].price:round(2)} | Total: $' + '{d.items[i].qty:mul(.price):round(2)}',
    '',
    'SUMMARY:',
    'Total Items: {d.items[].description:aggCount()}',
    'Total Amount: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}',
    '',
    'Thank you for your business!'
  ].join('\n')

  try {
    const result = await engine.render({
      template: { content: textTemplate, format: DocumentFormat.TXT },
      data
    })

    const outputPath = path.join(outputDir, 'invoice-simple.txt')
    await fs.writeFile(outputPath, result.content)
    
    console.log('✅ Text template generated successfully')
    console.log(`   File: ${outputPath}`)
    console.log(`   Size: ${result.content.length} bytes`)
    console.log(`   Preview:`)
    console.log('   ' + result.content.toString().split('\n').slice(0, 5).join('\n   '))
    console.log('   ...\n')
    
  } catch (error) {
    console.error('❌ Text template generation failed:', error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testHtmlTemplate(engine: TemplateEngine, data: any, outputDir: string) {
  console.log('2. Testing HTML Template')
  console.log('=========================')
  
  // Build HTML template using string concatenation to avoid TypeScript issues
  let htmlTemplate = ''
  htmlTemplate += '<!DOCTYPE html>\n'
  htmlTemplate += '<html lang="en">\n'
  htmlTemplate += '<head>\n'
  htmlTemplate += '    <meta charset="UTF-8">\n'
  htmlTemplate += '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
  htmlTemplate += '    <title>Invoice - {d.invoiceNumber}</title>\n'
  htmlTemplate += '    <style>\n'
  htmlTemplate += '        body {\n'
  htmlTemplate += '            font-family: Arial, sans-serif;\n'
  htmlTemplate += '            margin: 0;\n'
  htmlTemplate += '            padding: 20px;\n'
  htmlTemplate += '            color: #333;\n'
  htmlTemplate += '            line-height: 1.6;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .invoice-container {\n'
  htmlTemplate += '            max-width: 800px;\n'
  htmlTemplate += '            margin: 0 auto;\n'
  htmlTemplate += '            background: white;\n'
  htmlTemplate += '            box-shadow: 0 0 10px rgba(0,0,0,0.1);\n'
  htmlTemplate += '            padding: 40px;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .header {\n'
  htmlTemplate += '            display: flex;\n'
  htmlTemplate += '            justify-content: space-between;\n'
  htmlTemplate += '            margin-bottom: 40px;\n'
  htmlTemplate += '            border-bottom: 3px solid #007acc;\n'
  htmlTemplate += '            padding-bottom: 20px;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .company-info h1 {\n'
  htmlTemplate += '            color: #007acc;\n'
  htmlTemplate += '            margin: 0;\n'
  htmlTemplate += '            font-size: 28px;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .invoice-info {\n'
  htmlTemplate += '            text-align: right;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .invoice-info h2 {\n'
  htmlTemplate += '            color: #007acc;\n'
  htmlTemplate += '            margin: 0 0 10px 0;\n'
  htmlTemplate += '            font-size: 24px;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .customer-section {\n'
  htmlTemplate += '            margin: 30px 0;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .customer-section h3 {\n'
  htmlTemplate += '            color: #007acc;\n'
  htmlTemplate += '            border-bottom: 1px solid #ddd;\n'
  htmlTemplate += '            padding-bottom: 5px;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .items-table {\n'
  htmlTemplate += '            width: 100%;\n'
  htmlTemplate += '            border-collapse: collapse;\n'
  htmlTemplate += '            margin: 30px 0;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .items-table th {\n'
  htmlTemplate += '            background-color: #007acc;\n'
  htmlTemplate += '            color: white;\n'
  htmlTemplate += '            padding: 12px;\n'
  htmlTemplate += '            text-align: left;\n'
  htmlTemplate += '            font-weight: bold;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .items-table td {\n'
  htmlTemplate += '            padding: 12px;\n'
  htmlTemplate += '            border-bottom: 1px solid #ddd;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .total-section {\n'
  htmlTemplate += '            margin-top: 30px;\n'
  htmlTemplate += '            text-align: right;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '        .total-final {\n'
  htmlTemplate += '            font-size: 20px;\n'
  htmlTemplate += '            font-weight: bold;\n'
  htmlTemplate += '            color: #007acc;\n'
  htmlTemplate += '            border-top: 2px solid #007acc;\n'
  htmlTemplate += '            padding-top: 10px;\n'
  htmlTemplate += '        }\n'
  htmlTemplate += '    </style>\n'
  htmlTemplate += '</head>\n'
  htmlTemplate += '<body>\n'
  htmlTemplate += '    <div class="invoice-container">\n'
  htmlTemplate += '        <div class="header">\n'
  htmlTemplate += '            <div class="company-info">\n'
  htmlTemplate += '                <h1>{d.company.name}</h1>\n'
  htmlTemplate += '                <div>{d.company.address}</div>\n'
  htmlTemplate += '                <div>Phone: {d.company.phone}</div>\n'
  htmlTemplate += '                <div>Email: {d.company.email}</div>\n'
  htmlTemplate += '            </div>\n'
  htmlTemplate += '            <div class="invoice-info">\n'
  htmlTemplate += '                <h2>INVOICE</h2>\n'
  htmlTemplate += '                <div><strong>Invoice #:</strong> {d.invoiceNumber}</div>\n'
  htmlTemplate += '                <div><strong>Date:</strong> {d.date}</div>\n'
  htmlTemplate += '            </div>\n'
  htmlTemplate += '        </div>\n\n'
  htmlTemplate += '        <div class="customer-section">\n'
  htmlTemplate += '            <h3>Bill To:</h3>\n'
  htmlTemplate += '            <div><strong>{d.customer.name}</strong></div>\n'
  htmlTemplate += '            <div>{d.customer.email}</div>\n'
  htmlTemplate += '            <div>{d.customer.address}</div>\n'
  htmlTemplate += '        </div>\n\n'
  htmlTemplate += '        <table class="items-table">\n'
  htmlTemplate += '            <thead>\n'
  htmlTemplate += '                <tr>\n'
  htmlTemplate += '                    <th>Description</th>\n'
  htmlTemplate += '                    <th style="text-align: center;">Quantity</th>\n'
  htmlTemplate += '                    <th style="text-align: right;">Unit Price</th>\n'
  htmlTemplate += '                    <th style="text-align: right;">Total</th>\n'
  htmlTemplate += '                </tr>\n'
  htmlTemplate += '            </thead>\n'
  htmlTemplate += '            <tbody>\n'
  htmlTemplate += '                <tr>\n'
  htmlTemplate += '                    <td>{d.items[i].description}</td>\n'
  htmlTemplate += '                    <td style="text-align: center;">{d.items[i].qty}</td>\n'
  htmlTemplate += '                    <td style="text-align: right;">$' + '{d.items[i].price:round(2)}</td>\n'
  htmlTemplate += '                    <td style="text-align: right;">$' + '{d.items[i].qty:mul(.price):round(2)}</td>\n'
  htmlTemplate += '                </tr>\n'
  htmlTemplate += '            </tbody>\n'
  htmlTemplate += '        </table>\n\n'
  htmlTemplate += '        <div class="total-section">\n'
  htmlTemplate += '            <div>Items Count: {d.items[].description:aggCount()}</div>\n'
  htmlTemplate += '            <div class="total-final">\n'
  htmlTemplate += '                Total Amount: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}\n'
  htmlTemplate += '            </div>\n'
  htmlTemplate += '        </div>\n\n'
  htmlTemplate += '        <div style="margin-top: 50px; text-align: center; color: #666;">\n'
  htmlTemplate += '            <p>Thank you for your business!</p>\n'
  htmlTemplate += '            <p>Generated on {d.date}</p>\n'
  htmlTemplate += '        </div>\n'
  htmlTemplate += '    </div>\n'
  htmlTemplate += '</body>\n'
  htmlTemplate += '</html>'

  try {
    const result = await engine.render({
      template: { content: htmlTemplate, format: DocumentFormat.HTML },
      data
    })

    const outputPath = path.join(outputDir, 'invoice-styled.html')
    await fs.writeFile(outputPath, result.content)
    
    console.log('✅ HTML template generated successfully')
    console.log(`   File: ${outputPath}`)
    console.log(`   Size: ${result.content.length} bytes`)
    console.log(`   Open in browser to view styled invoice\n`)
    
  } catch (error) {
    console.error('❌ HTML template generation failed:', error instanceof Error ? error.message : 'Unknown error')
  }
}

async function testEnhancedTemplate(engine: TemplateEngine, data: any, outputDir: string) {
  console.log('3. Testing Enhanced Template with All Features')
  console.log('===============================================')
  
  const enhancedTemplate = [
    '========================================',
    '           PROFESSIONAL INVOICE         ',
    '========================================',
    '',
    'Company: {d.company.name}',
    'Address: {d.company.address}',
    'Phone: {d.company.phone}',
    'Email: {d.company.email}',
    '',
    'Invoice #: {d.invoiceNumber}',
    'Date: {d.date}',
    '',
    '========================================',
    '                BILL TO                 ',
    '========================================',
    '',
    'Customer: {d.customer.name}',
    'Email: {d.customer.email}',
    'Address: {d.customer.address}',
    '',
    '========================================',
    '              ITEM DETAILS              ',
    '========================================',
    '',
    'Description: {d.items[i].description}',
    'Quantity: {d.items[i].qty}',
    'Unit Price: $' + '{d.items[i].price:round(2)}',
    'Line Total: $' + '{d.items[i].qty:mul(.price):round(2)}',
    '----------------------------------------',
    '',
    '========================================',
    '               SUMMARY                  ',
    '========================================',
    '',
    'Total Items: {d.items[].description:aggCount()}',
    'Total Quantity: {d.items[].qty:aggSum()}',
    'Average Price: $' + '{d.items[].price:aggAvg():round(2)}',
    'Highest Price: $' + '{d.items[].price:aggMax():round(2)}',
    'Lowest Price: $' + '{d.items[].price:aggMin():round(2)}',
    '',
    '========================================',
    'TOTAL AMOUNT DUE: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}',
    '========================================',
    '',
    'Thank you for your business!',
    'Generated on {d.date}'
  ].join('\n')

  try {
    const result = await engine.render({
      template: { content: enhancedTemplate, format: DocumentFormat.TXT },
      data
    })

    const outputPath = path.join(outputDir, 'invoice-enhanced.txt')
    await fs.writeFile(outputPath, result.content)
    
    console.log('✅ Enhanced template generated successfully')
    console.log(`   File: ${outputPath}`)
    console.log(`   Size: ${result.content.length} bytes`)
    console.log(`   Features demonstrated:`)
    console.log(`   - Array iteration: ✅`)
    console.log(`   - Dynamic calculations: ✅`) 
    console.log(`   - Aggregation functions: ✅`)
    console.log(`   - Formatted output: ✅\n`)
    
    // Show a preview
    const preview = result.content.toString().split('\n')
    console.log(`   Preview (first 10 lines):`)
    preview.slice(0, 10).forEach((line, i) => {
      console.log(`   ${(i + 1).toString().padStart(2, ' ')}: ${line}`)
    })
    console.log(`   ... (${preview.length} total lines)\n`)
    
  } catch (error) {
    console.error('❌ Enhanced template generation failed:', error instanceof Error ? error.message : 'Unknown error')
    console.error('   Full error:', error)
  }
}

// Simple test function that just uses your existing engine
export async function simpleDocumentTest() {
  console.log('🔧 Simple Document Test\n')
  
  const engine = new TemplateEngine()
  
  const testData = {
    name: "Test User",
    items: [
      { product: "Item A", qty: 2, price: 10.50 },
      { product: "Item B", qty: 1, price: 25.00 }
    ]
  }
  
  const template = [
    'Hello {d.name}!',
    '',
    'Your order:',
    '{d.items[i].product} - Qty: {d.items[i].qty} @ $' + '{d.items[i].price} = $' + '{d.items[i].qty:mul(.price):round(2)}',
    '',
    'Total: $' + '{d.items[].qty:mul(.price):aggSum():round(2)}'
  ].join('\n')
  
  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data: testData
    })
    
    console.log('✅ Simple test passed!')
    console.log('Result:')
    console.log(result.content.toString())
    
    // Save result
    const outputDir = path.join(process.cwd(), 'output')
    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(path.join(outputDir, 'simple-test.txt'), result.content)
    
  } catch (error) {
    console.error('❌ Simple test failed:',error instanceof Error ? error.message : 'Unknown error')
  }
}

// Main execution
if (require.main === module) {
  Promise.resolve()
    .then(() => simpleDocumentTest())
    .then(() => console.log('\n' + '='.repeat(60) + '\n'))
    .then(() => documentFormatExamples())
    .catch(console.error)
}