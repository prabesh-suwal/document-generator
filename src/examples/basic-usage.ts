
import { TemplateEngine, DocumentFormat } from '../index'

async function basicExample() {
  const engine = new TemplateEngine()

  // Simple template with basic data injection
  const template = `
Hello {d.name:ucFirst}!

Your order details:
- Product: {d.product:upperCase}
- Quantity: {d.quantity}
- Price: $\{d.price:round(2)}
- Total: $\{d.quantity:mul(.price):round(2)}

Status: {d.status:eq('completed'):ifTrue('✓ Completed', '⏳ Pending')}
  `.trim()

  const data = {
    name: 'john doe',
    product: 'laptop computer',
    quantity: 2,
    price: 999.99,
    status: 'completed'
  }

  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data
    })

    console.log('Rendered document:')
    console.log(result.content.toString())
    console.log('\nMetadata:', result.metadata)
  } catch (error) {
    console.error('Rendering failed:', error)
  }
}

async function arrayExample() {
  const engine = new TemplateEngine()

  const template = `
Invoice #INV-001
Date: {d.date}

Customer: {d.customer.name}
Email: {d.customer.email}

Items:
{d.items[i].name} - Qty: {d.items[i].quantity} - Price: $\{d.items[i].price:round(2)} - Total: $\{d.items[i].quantity:mul(.price):round(2)}

Subtotal: $\{d.items[].price:mul(.quantity):aggSum():round(2)}
Tax (8%): $\{d.items[].price:mul(.quantity):aggSum():mul(0.08):round(2)}
Total: $\{d.items[].price:mul(.quantity):aggSum():mul(1.08):round(2)}

Thank you for your business!
  `.trim()

  const data = {
    date: '2024-01-15',
    customer: {
      name: 'Jane Smith',
      email: 'jane@example.com'
    },
    items: [
      { name: 'Laptop', quantity: 1, price: 1299.99 },
      { name: 'Mouse', quantity: 2, price: 25.99 },
      { name: 'Keyboard', quantity: 1, price: 79.99 }
    ]
  }

  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data
    })

    console.log('Invoice:')
    console.log(result.content.toString())
  } catch (error) {
    console.error('Rendering failed:', error)
  }
}

async function conditionalExample() {
  const engine = new TemplateEngine()

  const template = `
User Report
===========

{d.users[i].name} ({d.users[i].age} years old)
Status: {d.users[i].active:ifTrue('Active', 'Inactive')}
Role: {d.users[i].role:ucFirst}
Access Level: {d.users[i].role:eq('admin'):ifTrue('Full Access', 'Limited Access')}

---
  `.trim()

  const data = {
    users: [
      { name: 'Alice Johnson', age: 28, active: true, role: 'admin' },
      { name: 'Bob Wilson', age: 35, active: false, role: 'user' },
      { name: 'Carol Davis', age: 42, active: true, role: 'moderator' }
    ]
  }

  try {
    const result = await engine.render({
      template: { content: template, format: DocumentFormat.TXT },
      data
    })

    console.log('User Report:')
    console.log(result.content.toString())
  } catch (error) {
    console.error('Rendering failed:', error)
  }
}

// Run examples
if (require.main === module) {
  console.log('=== Basic Example ===')
  basicExample()
    .then(() => {
      console.log('\n=== Array Example ===')
      return arrayExample()
    })
    .then(() => {
      console.log('\n=== Conditional Example ===')
      return conditionalExample()
    })
    .catch(console.error)
}