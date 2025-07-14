// // examples/invoice-template.js

// const { TemplateEngine } = require('../dist/handlers/DocumentArrayProcessor');
// const { DocumentFormat } = require('../dist/types/core');

// async function generateInvoice() {
//   console.log('📄 Generating Invoice Example...\n');
  
//   const engine = new TemplateEngine();
  
//   // Invoice template (simplified to work with current implementation)
//   const invoiceTemplate = `
// INVOICE #{d.invoiceNumber}
// ========================
// Date: {d.date}
// Due: {d.dueDate}

// Bill To:
// {d.customer.name:upperCase}
// {d.customer.address}
// {d.customer.city}, {d.customer.state} {d.customer.zip}
// Email: {d.customer.email:lowerCase}

// Items:
// ------
// {d.items[0].description} | Qty: {d.items[0].quantity} | Price: ${d.items[0].price:round(2)} | Total: ${d.items[0].total:round(2)}
// {d.items[1].description} | Qty: {d.items[1].quantity} | Price: ${d.items[1].price:round(2)} | Total: ${d.items[1].total:round(2)}
// {d.items[2].description} | Qty: {d.items[2].quantity} | Price: ${d.items[2].price:round(2)} | Total: ${d.items[2].total:round(2)}

// Summary:
// --------
// Subtotal: ${d.subtotal:round(2)}
// Tax ({d.taxRate:mul(100)}%): ${d.tax:round(2)}
// Total: ${d.total:round(2)}

// Payment Terms: Net 30 days
// Thank you for your business!
// `;

//   // Sample data with calculated totals
//   const invoiceData = {
//     invoiceNumber: 'INV-2025-001',
//     date: '2025-01-15',
//     dueDate: '2025-02-14',
//     taxRate: 0.08,
//     customer: {
//       name: 'acme corporation',
//       address: '123 Business St',
//       city: 'Business City',
//       state: 'BC',
//       zip: '12345',
//       email: 'ACCOUNTING@ACME.COM'
//     },
//     items: [
//       {
//         description: 'Professional Services - Web Development',
//         quantity: 40,
//         price: 125.00,
//         total: 5000.00
//       },
//       {
//         description: 'Domain Registration (1 year)',
//         quantity: 1,
//         price: 15.99,
//         total: 15.99
//       },
//       {
//         description: 'SSL Certificate',
//         quantity: 1,
//         price: 89.99,
//         total: 89.99
//       }
//     ],
//     subtotal: 5105.98,
//     tax: 408.48,
//     total: 5514.46
//   };
  
//   try {
//     const result = await engine.render({
//       template: {
//         content: invoiceTemplate,
//         format: DocumentFormat.TXT
//       },
//       data: invoiceData
//     });
    
//     console.log('Generated Invoice:');
//     console.log('==================');
//     console.log(result.content.toString());
    
//     // Save to file if needed
//     const fs = require('fs');
//     if (!fs.existsSync('output')) {
//       fs.mkdirSync('output');
//     }
//     fs.writeFileSync('output/invoice-output.txt', result.content.toString());
//     console.log('\n✅ Invoice saved to output/invoice-output.txt');
    
//   } catch (error) {
//     console.error('❌ Invoice generation failed:', error.message);
//     console.error('Stack:', error.stack);
//   }
// }

// generateInvoice();