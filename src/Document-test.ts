// // ============================================================================
// // COMPREHENSIVE DOCUMENT HANDLER TESTS
// // ============================================================================

// import * as fs from 'fs'
// import * as path from 'path'
// import { 
//   EnhancedTemplateEngine, 
//   TemplateEngineWithConversion,
//   DocumentFormat 
// } from '../src/handlers/DocumentFormatHandlers'

// // ============================================================================
// // 1. TEST DATA SETUP
// // ============================================================================

// const testData = {
//   invoice: {
//     number: 'INV-2024-001',
//     date: '2024-01-15',
//     dueDate: '2024-02-15'
//   },
//   customer: {
//     name: 'Acme Corporation',
//     address: '123 Business Ave\nSuite 100\nNew York, NY 10001',
//     email: 'billing@acme.com',
//     phone: '+1 (555) 123-4567'
//   },
//   vendor: {
//     name: 'Your Company Inc.',
//     address: '456 Commerce St\nBusinessville, CA 90210',
//     email: 'invoices@yourcompany.com',
//     taxId: '12-3456789'
//   },
//   items: [
//     {
//       description: 'Website Development',
//       quantity: 1,
//       price: 5000.00,
//       category: 'Development'
//     },
//     {
//       description: 'SEO Optimization',
//       quantity: 3,
//       price: 500.00,
//       category: 'Marketing'
//     },
//     {
//       description: 'Content Management Training',
//       quantity: 2,
//       price: 250.00,
//       category: 'Training'
//     }
//   ],
//   terms: {
//     payment: '30 days net',
//     late_fee: '1.5% per month',
//     currency: 'USD'
//   }
// }

// // ============================================================================
// // 2. HTML TEMPLATE TESTS
// // ============================================================================

// export async function testHtmlTemplate() {
//   console.log('🧪 Testing HTML Template Processing...')
  
//   const htmlTemplate = `<!DOCTYPE html>
// <html>
// <head>
//     <meta charset="UTF-8">
//     <title>Invoice {d.invoice.number}</title>
//     <style>
//         body { 
//             font-family: 'Segoe UI', Arial, sans-serif; 
//             margin: 0; 
//             padding: 40px; 
//             color: #333;
//             line-height: 1.6;
//         }
//         .header { 
//             border-bottom: 3px solid #2c5aa0; 
//             padding-bottom: 20px; 
//             margin-bottom: 30px;
//             display: flex;
//             justify-content: space-between;
//             align-items: flex-start;
//         }
//         .company-info {
//             flex: 1;
//         }
//         .invoice-info {
//             text-align: right;
//             flex: 1;
//         }
//         .invoice-title {
//             color: #2c5aa0;
//             font-size: 28px;
//             font-weight: bold;
//             margin: 0;
//         }
//         .section {
//             margin: 30px 0;
//         }
//         .section-title {
//             color: #2c5aa0;
//             font-size: 18px;
//             font-weight: bold;
//             margin-bottom: 15px;
//             border-bottom: 1px solid #eee;
//             padding-bottom: 5px;
//         }
//         .customer-info {
//             background: #f8f9fa;
//             padding: 20px;
//             border-radius: 8px;
//             border-left: 4px solid #2c5aa0;
//         }
//         .items-table {
//             width: 100%;
//             border-collapse: collapse;
//             margin: 20px 0;
//             background: white;
//             box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//         }
//         .items-table th {
//             background: #2c5aa0;
//             color: white;
//             padding: 15px;
//             text-align: left;
//             font-weight: 600;
//         }
//         .items-table td {
//             padding: 12px 15px;
//             border-bottom: 1px solid #eee;
//         }
//         .items-table tbody tr:hover {
//             background: #f8f9fa;
//         }
//         .total-section {
//             margin-top: 30px;
//             text-align: right;
//         }
//         .total-row {
//             display: flex;
//             justify-content: flex-end;
//             margin: 8px 0;
//             font-size: 16px;
//         }
//         .total-label {
//             width: 120px;
//             text-align: right;
//             margin-right: 20px;
//             font-weight: 600;
//         }
//         .total-value {
//             width: 100px;
//             text-align: right;
//         }
//         .grand-total {
//             border-top: 2px solid #2c5aa0;
//             padding-top: 10px;
//             font-size: 20px;
//             font-weight: bold;
//             color: #2c5aa0;
//         }
//         .terms {
//             margin-top: 40px;
//             padding: 20px;
//             background: #fff3cd;
//             border: 1px solid #ffeaa7;
//             border-radius: 8px;
//         }
//         .terms-title {
//             font-weight: bold;
//             color: #856404;
//             margin-bottom: 10px;
//         }
//     </style>
// </head>
// <body>
//     <div class="header">
//         <div class="company-info">
//             <h1 class="invoice-title">INVOICE</h1>
//             <div style="margin-top: 20px;">
//                 <strong>{d.vendor.name}</strong><br>
//                 {d.vendor.address}<br>
//                 Email: {d.vendor.email}<br>
//                 Tax ID: {d.vendor.taxId}
//             </div>
//         </div>
//         <div class="invoice-info">
//             <div style="font-size: 24px; font-weight: bold; color: #2c5aa0;">
//                 #{d.invoice.number}
//             </div>
//             <div style="margin-top: 15px;">
//                 <strong>Invoice Date:</strong> {d.invoice.date}<br>
//                 <strong>Due Date:</strong> {d.invoice.dueDate}
//             </div>
//         </div>
//     </div>

//     <div class="section">
//         <div class="section-title">Bill To</div>
//         <div class="customer-info">
//             <strong>{d.customer.name}</strong><br>
//             {d.customer.address}<br>
//             Email: {d.customer.email}<br>
//             Phone: {d.customer.phone}
//         </div>
//     </div>

//     <div class="section">
//         <div class="section-title">Items & Services</div>
//         <table class="items-table">
//             <thead>
//                 <tr>
//                     <th>Description</th>
//                     <th>Category</th>
//                     <th style="text-align: center;">Quantity</th>
//                     <th style="text-align: right;">Unit Price</th>
//                     <th style="text-align: right;">Total</th>
//                 </tr>
//             </thead>
//             <tbody>
//                 <tr>
//                     <td>{d.items[i].description}</td>
//                     <td><span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; font-size: 12px;">{d.items[i].category}</span></td>
//                     <td style="text-align: center;">{d.items[i].quantity}</td>
//                     <td style="text-align: right;">${d.items[i].price:round(2)}</td>
//                     <td style="text-align: right; font-weight: 600;">${d.items[i].quantity:mul(.price):round(2)}</td>
//                 </tr>
//             </tbody>
//         </table>
        
//         <div class="total-section">
//             <div class="total-row">
//                 <div class="total-label">Subtotal:</div>
//                 <div class="total-value">${d.items[].quantity:mul(.price):aggSum():round(2)}</div>
//             </div>
//             <div class="total-row">
//                 <div class="total-label">Tax (8.5%):</div>
//                 <div class="total-value">${d.items[].quantity:mul(.price):aggSum():mul(0.085):round(2)}</div>
//             </div>
//             <div class="total-row grand-total">
//                 <div class="total-label">Total:</div>
//                 <div class="total-value">${d.items[].quantity:mul(.price):aggSum():mul(1.085):round(2)}</div>
//             </div>
//         </div>
//     </div>

//     <div class="terms">
//         <div class="terms-title">Payment Terms</div>
//         <p><strong>Payment Terms:</strong> {d.terms.payment}</p>
//         <p><strong>Late Fee:</strong> {d.terms.late_fee}</p>
//         <p><strong>Currency:</strong> {d.terms.currency}</p>
//         <p style="margin-top: 15px; font-style: italic;">
//             Thank you for your business! Please remit payment by the due date to avoid late fees.
//         </p>
//     </div>
// </body>
// </html>`

//   const engine = new TemplateEngineWithConversion()
  
//   try {
//     // Test HTML rendering
//     const htmlResult = await engine.renderWithConversion({
//       template: {
//         content: htmlTemplate,
//         format: DocumentFormat.HTML
//       },
//       data: testData
//     })
    
//     console.log('✅ HTML template processed successfully')
//     console.log(`📊 Output size: ${htmlResult.content.length} bytes`)
    
//     // Save HTML output
//     fs.writeFileSync('./test-output-invoice.html', htmlResult.content)
//     console.log('💾 HTML saved to: ./test-output-invoice.html')
    
//     // Test HTML to PDF conversion
//     console.log('🔄 Converting HTML to PDF...')
//     const pdfResult = await engine.renderWithConversion({
//       template: {
//         content: htmlTemplate,
//         format: DocumentFormat.HTML
//       },
//       data: testData,
//       options: {
//         convertTo: DocumentFormat.PDF
//       }
//     })
    
//     console.log('✅ PDF conversion successful')
//     console.log(`📊 PDF size: ${pdfResult.content.length} bytes`)
    
//     // Save PDF output
//     fs.writeFileSync('./test-output-invoice.pdf', pdfResult.content)
//     console.log('💾 PDF saved to: ./test-output-invoice.pdf')
    
//     return true
//   } catch (error) {
//     console.error('❌ HTML template test failed:', error)
//     return false
//   }
// }

// // ============================================================================
// // 3. DOCX TEMPLATE TESTS
// // ============================================================================

// export async function testDocxTemplate() {
//   console.log('🧪 Testing DOCX Template Processing...')
  
//   // Create a simple DOCX template content (Word XML structure)
//   const docxTemplateContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
// <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
//     <w:body>
//         <w:p>
//             <w:r>
//                 <w:t>INVOICE {d.invoice.number}</w:t>
//             </w:r>
//         </w:p>
//         <w:p>
//             <w:r>
//                 <w:t>Date: {d.invoice.date}</w:t>
//             </w:r>
//         </w:p>
//         <w:p>
//             <w:r>
//                 <w:t>Customer: {d.customer.name}</w:t>
//             </w:r>
//         </w:p>
//         <w:p>
//             <w:r>
//                 <w:t>Address: {d.customer.address}</w:t>
//             </w:r>
//         </w:p>
//         <w:p>
//             <w:r>
//                 <w:t>Items:</w:t>
//             </w:r>
//         </w:p>
//         <w:p>
//             <w:r>
//                 <w:t>{d.items[i].description} - Qty: {d.items[i].quantity} - ${d.items[i].price:round(2)} - Total: ${d.items[i].quantity:mul(.price):round(2)}</w:t>
//             </w:r>
//         </w:p>
//         <w:p>
//             <w:r>
//                 <w:t>Grand Total: ${d.items[].quantity:mul(.price):aggSum():round(2)}</w:t>
//             </w:r>
//         </w:p>
//     </w:body>
// </w:document>`

//   // Note: In a real implementation, you'd load an actual DOCX file
//   // For testing, we'll use the text representation
//   const engine = new TemplateEngineWithConversion()
  
//   try {
//     // Test basic DOCX processing (using text content for now)
//     const result = await engine.renderWithConversion({
//       template: {
//         content: docxTemplateContent,
//         format: DocumentFormat.TXT // Using TXT for now since we need actual DOCX files
//       },
//       data: testData
//     })
    
//     console.log('✅ DOCX-style template processed successfully')
//     console.log(`📊 Output size: ${result.content.length} bytes`)
    
//     // Save output
//     fs.writeFileSync('./test-output-docx-content.txt', result.content)
//     console.log('💾 DOCX content saved to: ./test-output-docx-content.txt')
    
//     return true
//   } catch (error) {
//     console.error('❌ DOCX template test failed:', error)
//     return false
//   }
// }

// // ============================================================================
// // 4. EXCEL TEMPLATE TESTS
// // ============================================================================

// export async function testExcelTemplate() {
//   console.log('🧪 Testing Excel Template Processing...')
  
//   // Create Excel-like template data structure
//   const excelTemplateData = {
//     worksheets: [
//       {
//         name: 'Invoice',
//         data: [
//           ['Invoice Number:', '{d.invoice.number}', '', 'Date:', '{d.invoice.date}'],
//           ['', '', '', '', ''],
//           ['Customer:', '{d.customer.name}', '', '', ''],
//           ['Address:', '{d.customer.address}', '', '', ''],
//           ['', '', '', '', ''],
//           ['Description', 'Category', 'Quantity', 'Unit Price', 'Total'],
//           ['{d.items[i].description}', '{d.items[i].category}', '{d.items[i].quantity}', '{d.items[i].price}', '{d.items[i].quantity:mul(.price):round(2)}'],
//           ['', '', '', '', ''],
//           ['', '', '', 'Grand Total:', '{d.items[].quantity:mul(.price):aggSum():round(2)}']
//         ]
//       }
//     ]
//   }
  
//   const engine = new EnhancedTemplateEngine()
  
//   try {
//     // Convert to JSON string for processing
//     const templateContent = JSON.stringify(excelTemplateData, null, 2)
    
//     const result = await engine.renderWithFormat({
//       template: {
//         content: templateContent,
//         format: DocumentFormat.TXT // Using TXT representation for now
//       },
//       data: testData
//     })
    
//     console.log('✅ Excel-style template processed successfully')
//     console.log(`📊 Output size: ${result.content.length} bytes`)
    
//     // Save output
//     fs.writeFileSync('./test-output-excel-content.json', result.content)
//     console.log('💾 Excel content saved to: ./test-output-excel-content.json')
    
//     return true
//   } catch (error) {
//     console.error('❌ Excel template test failed:', error)
//     return false
//   }
// }

// // ============================================================================
// // 5. ARRAY ITERATION STRESS TEST
// // ============================================================================

// export async function testArrayIterationStress() {
//   console.log('🧪 Testing Array Iteration Stress Test...')
  
//   // Create large dataset
//   const largeDataset = {
//     company: 'Test Company',
//     report_date: '2024-01-15',
//     transactions: []
//   }
  
//   // Generate 100 transactions
//   for (let i = 1; i <= 100; i++) {
//     largeDataset.transactions.push({
//       id: `TXN-${i.toString().padStart(3, '0')}`,
//       date: `2024-01-${(i % 28 + 1).toString().padStart(2, '0')}`,
//       amount: Math.round((Math.random() * 1000 + 100) * 100) / 100,
//       description: `Transaction ${i}`,
//       category: ['Sales', 'Marketing', 'Operations', 'Support'][i % 4]
//     })
//   }
  
//   const htmlTemplate = `<!DOCTYPE html>
// <html>
// <head>
//     <title>Transaction Report - {d.company}</title>
//     <style>
//         body { font-family: Arial, sans-serif; margin: 20px; }
//         .header { background: #f0f0f0; padding: 20px; margin-bottom: 20px; }
//         .transaction-table { width: 100%; border-collapse: collapse; }
//         .transaction-table th, .transaction-table td { 
//             border: 1px solid #ddd; 
//             padding: 8px; 
//             text-align: left; 
//         }
//         .transaction-table th { background: #f2f2f2; }
//         .transaction-table tbody tr:nth-child(even) { background: #f9f9f9; }
//         .summary { margin-top: 30px; padding: 20px; background: #e8f5e8; }
//     </style>
// </head>
// <body>
//     <div class="header">
//         <h1>Transaction Report</h1>
//         <p><strong>Company:</strong> {d.company}</p>
//         <p><strong>Report Date:</strong> {d.report_date}</p>
//         <p><strong>Total Transactions:</strong> {d.transactions[].id:aggCount()}</p>
//     </div>

//     <table class="transaction-table">
//         <thead>
//             <tr>
//                 <th>ID</th>
//                 <th>Date</th>
//                 <th>Description</th>
//                 <th>Category</th>
//                 <th>Amount</th>
//             </tr>
//         </thead>
//         <tbody>
//             <tr>
//                 <td>{d.transactions[i].id}</td>
//                 <td>{d.transactions[i].date}</td>
//                 <td>{d.transactions[i].description}</td>
//                 <td>{d.transactions[i].category}</td>
//                 <td>${d.transactions[i].amount:round(2)}</td>
//             </tr>
//         </tbody>
//     </table>

//     <div class="summary">
//         <h2>Summary</h2>
//         <p><strong>Total Amount:</strong> ${d.transactions[].amount:aggSum():round(2)}</p>
//         <p><strong>Average Transaction:</strong> ${d.transactions[].amount:aggAvg():round(2)}</p>
//         <p><strong>Largest Transaction:</strong> ${d.transactions[].amount:aggMax():round(2)}</p>
//         <p><strong>Smallest Transaction:</strong> ${d.transactions[].amount:aggMin():round(2)}</p>
//     </div>
// </body>
// </html>`

//   const engine = new TemplateEngineWithConversion()
  
//   try {
//     const startTime = Date.now()
    
//     const result = await engine.renderWithConversion({
//       template: {
//         content: htmlTemplate,
//         format: DocumentFormat.HTML
//       },
//       data: largeDataset,
//       options: {
//         convertTo: DocumentFormat.PDF
//       }
//     })
    
//     const endTime = Date.now()
//     const duration = endTime - startTime
    
//     console.log('✅ Array iteration stress test completed')
//     console.log(`⏱️  Processing time: ${duration}ms`)
//     console.log(`📊 Output size: ${result.content.length} bytes`)
//     console.log(`🔢 Processed ${largeDataset.transactions.length} array items`)
    
//     // Save outputs
//     fs.writeFileSync('./test-output-stress-report.pdf', result.content)
//     console.log('💾 Stress test PDF saved to: ./test-output-stress-report.pdf')
    
//     // Performance metrics
//     const itemsPerSecond = Math.round((largeDataset.transactions.length / duration) * 1000)
//     console.log(`⚡ Performance: ${itemsPerSecond} items/second`)
    
//     return { success: true, duration, itemsPerSecond }
//   } catch (error) {
//     console.error('❌ Array iteration stress test failed:', error)
//     return { success: false, error }
//   }
// }

// // ============================================================================
// // 6. FORMATTER CHAIN TESTS
// // ============================================================================

// export async function testFormatterChains() {
//   console.log('🧪 Testing Complex Formatter Chains...')
  
//   const complexData = {
//     users: [
//       { name: 'john doe', email: 'JOHN@EXAMPLE.COM', score: 85.7834, active: true },
//       { name: 'jane smith', email: 'JANE@EXAMPLE.COM', score: 92.1234, active: false },
//       { name: 'bob johnson', email: 'BOB@EXAMPLE.COM', score: 78.9876, active: true }
//     ],
//     settings: {
//       precision: 2,
//       currency: 'USD'
//     }
//   }
  
//   const formatterTemplate = `<!DOCTYPE html>
// <html>
// <head>
//     <title>Formatter Chain Test</title>
//     <style>
//         body { font-family: Arial, sans-serif; margin: 20px; }
//         .user-card { 
//             border: 1px solid #ddd; 
//             padding: 15px; 
//             margin: 10px 0; 
//             border-radius: 8px;
//         }
//         .active { background: #e8f5e8; }
//         .inactive { background: #ffe8e8; }
//     </style>
// </head>
// <body>
//     <h1>User Report</h1>
    
//     <div class="user-card {d.users[i].active:ifTrue('active', 'inactive')}">
//         <h3>User: {d.users[i].name:ucFirst}</h3>
//         <p><strong>Email:</strong> {d.users[i].email:lowerCase}</p>
//         <p><strong>Score:</strong> {d.users[i].score:round(2)}</p>
//         <p><strong>Status:</strong> {d.users[i].active:ifTrue('Active User', 'Inactive User')}</p>
//         <p><strong>Grade:</strong> {d.users[i].score:round(0):eq(90):ifTrue('A', 'B')}</p>
//     </div>
    
//     <div style="margin-top: 30px; padding: 20px; background: #f0f0f0;">
//         <h2>Summary Statistics</h2>
//         <p><strong>Total Users:</strong> {d.users[].name:aggCount()}</p>
//         <p><strong>Average Score:</strong> {d.users[].score:aggAvg():round(2)}</p>
//         <p><strong>Highest Score:</strong> {d.users[].score:aggMax():round(2)}</p>
//         <p><strong>Active Users:</strong> {d.users[active=true].name:aggCount()}</p>
//     </div>
// </body>
// </html>`

//   const engine = new EnhancedTemplateEngine()
  
//   try {
//     const result = await engine.renderWithFormat({
//       template: {
//         content: formatterTemplate,
//         format: DocumentFormat.HTML
//       },
//       data: complexData
//     })
    
//     console.log('✅ Formatter chain test completed')
//     console.log(`📊 Output size: ${result.content.length} bytes`)
    
//     // Save output
//     fs.writeFileSync('./test-output-formatters.html', result.content)
//     console.log('💾 Formatter test saved to: ./test-output-formatters.html')
    
//     return true
//   } catch (error) {
//     console.error('❌ Formatter chain test failed:', error)
//     return false
//   }
// }

// // ============================================================================
// // 7. PERFORMANCE BENCHMARK
// // ============================================================================

// export async function performanceBenchmark() {
//   console.log('🧪 Running Performance Benchmark...')
  
//   const engine = new TemplateEngineWithConversion()
//   const simpleTemplate = `
//     <h1>Invoice {d.invoice.number}</h1>
//     <p>Customer: {d.customer.name}</p>
//     <p>Total: ${d.items[].quantity:mul(.price):aggSum():round(2)}</p>
//   `
  
//   const iterations = 100
//   const results = []
  
//   console.log(`⏱️  Running ${iterations} iterations...`)
  
//   for (let i = 0; i < iterations; i++) {
//     const startTime = Date.now()
    
//     await engine.renderWithConversion({
//       template: {
//         content: simpleTemplate,
//         format: DocumentFormat.HTML
//       },
//       data: testData
//     })
    
//     const duration = Date.now() - startTime
//     results.push(duration)
    
//     if ((i + 1) % 10 === 0) {
//       console.log(`⚡ Completed ${i + 1}/${iterations} iterations`)
//     }
//   }
  
//   // Calculate statistics
//   const avgTime = results.reduce((a, b) => a + b, 0) / results.length
//   const minTime = Math.min(...results)
//   const maxTime = Math.max(...results)
//   const medianTime = results.sort((a, b) => a - b)[Math.floor(results.length / 2)]
  
//   console.log('\n📊 Performance Results:')
//   console.log(`   Average: ${avgTime.toFixed(2)}ms`)
//   console.log(`   Median:  ${medianTime}ms`)
//   console.log(`   Min:     ${minTime}ms`)
//   console.log(`   Max:     ${maxTime}ms`)
//   console.log(`   Target:  <10ms (Carbone benchmark)`)
  
//   const passesTest = avgTime < 10
//   console.log(`   ${passesTest ? '✅' : '❌'} Performance test ${passesTest ? 'PASSED' : 'FAILED'}`)
  
//   return {
//     average: avgTime,
//     median: medianTime,
//     min: minTime,
//     max: maxTime,
//     passes: passesTest
//   }
// }

// // ============================================================================
// // 8. MAIN TEST RUNNER
// // ============================================================================

// export async function runAllTests() {
//   console.log('🚀 Starting Complete Document Handler Test Suite\n')
  
//   const results = {
//     html: false,
//     docx: false,
//     excel: false,
//     stress: false,
//     formatters: false,
//     performance: null
//   }
  
//   try {
//     // Create output directory
//     if (!fs.existsSync('./test-outputs')) {
//       fs.mkdirSync('./test-outputs')
//       console.log('📁 Created test-outputs directory\n')
//     }
    
//     // Run tests
//     results.html = await testHtmlTemplate()
//     console.log('')
    
//     results.docx = await testDocxTemplate()
//     console.log('')
    
//     results.excel = await testExcelTemplate()
//     console.log('')
    
//     results.stress = (await testArrayIterationStress()).success
//     console.log('')
    
//     results.formatters = await testFormatterChains()
//     console.log('')
    
//     results.performance = await performanceBenchmark()
//     console.log('')
    
//     // Print summary
//     console.log('📋 TEST SUMMARY:')
//     console.log(`   HTML Template:        ${results.html ? '✅ PASS' : '❌ FAIL'}`)
//     console.log(`   DOCX Template:        ${results.docx ? '✅ PASS' : '❌ FAIL'}`)
//     console.log(`   Excel Template:       ${results.excel ? '✅ PASS' : '❌ FAIL'}`)
//     console.log(`   Array Stress Test:    ${results.stress ? '✅ PASS' : '❌ FAIL'}`)
//     console.log(`   Formatter Chains:     ${results.formatters ? '✅ PASS' : '❌ FAIL'}`)
//     console.log(`   Performance Test:     ${results.performance?.passes ? '✅ PASS' : '❌ FAIL'}`)
    
//     const passCount = Object.values(results).filter(r => r === true).length + (results.performance?.passes ? 1 : 0)
//     const totalTests = 6
    
//     console.log(`\n🎯 Overall: ${passCount}/${totalTests} tests passed`)
    
//     return results
//   } catch (error) {
//     console.error('💥 Test suite failed:', error)
//     return results
//   }
// }

// // Usage example:
// // runAllTests().then(results => {
// //   console.log('Test suite completed:', results)
// //   process.exit(results.performance?.passes ? 0 : 1)
// // })