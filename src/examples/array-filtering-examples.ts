import { TemplateEngine } from '../engine/TemplateEngine'
import { DocumentFormat } from '../types/core'

export class ArrayFilteringExamples {
  private engine: TemplateEngine

  constructor() {
    this.engine = new TemplateEngine()
  }

  async runAllExamples() {
    console.log('🔍 Array Filtering Examples\n')
    
    await this.basicFilteringExample()
    await this.numericFilteringExample()
    await this.multipleFiltersExample()
    await this.stringOperationsExample()
    await this.aggregationWithFilteringExample()
    await this.complexExample()
  }

  private async basicFilteringExample() {
    console.log('1. Basic Status Filtering')
    console.log('==========================')
    
    // FIXED: Use string concatenation instead of template literals
    const template = [
      'Active Users:',
      '{d.users[status=\'active\'].name}',
      '{d.users[status=\'active\'].email}'
    ].join('\n')

    const data = {
      users: [
        { name: 'John Doe', status: 'active', email: 'john@example.com' },
        { name: 'Jane Smith', status: 'inactive', email: 'jane@example.com' },
        { name: 'Bob Johnson', status: 'active', email: 'bob@example.com' }
      ]
    }

    try {
      const result = await this.engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data
      })
      
      console.log('Result:')
      console.log(result.content.toString())
      console.log('Expected: John Doe, Bob Johnson\n')
    } catch (error) {
      console.error('Error:', error)
    }
  }

  private async numericFilteringExample() {
    console.log('2. Numeric Price Filtering')
    console.log('===========================')
    
    const template = [
      'Expensive Products (>$100):',
      '{d.products[price>100].name} - $' + '{d.products[price>100].price}',
      '',
      'Premium Count: {d.products[price>100][].name:aggCount()}'
    ].join('\n')

    const data = {
      products: [
        { name: 'Laptop', price: 1200 },
        { name: 'Mouse', price: 25 },
        { name: 'Monitor', price: 300 },
        { name: 'Keyboard', price: 75 }
      ]
    }

    try {
      const result = await this.engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data
      })
      
      console.log('Result:')
      console.log(result.content.toString())
      console.log('Expected: Laptop - $1200, Monitor - $300, Count: 2\n')
    } catch (error) {
      console.error('Error:', error)
    }
  }

  private async multipleFiltersExample() {
    console.log('3. Multiple Filters (AND Logic)')
    console.log('================================')
    
    const template = [
      'Active Admin Users:',
      '{d.users[role=\'admin\'][active=true].name:upperCase}'
    ].join('\n')

    const data = {
      users: [
        { name: 'John Doe', role: 'admin', active: true },
        { name: 'Jane Smith', role: 'admin', active: false },
        { name: 'Bob Johnson', role: 'user', active: true },
        { name: 'Alice Wilson', role: 'admin', active: true }
      ]
    }

    try {
      const result = await this.engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data
      })
      
      console.log('Result:')
      console.log(result.content.toString())
      console.log('Expected: JOHN DOE, ALICE WILSON\n')
    } catch (error) {
      console.error('Error:', error)
    }
  }

  private async stringOperationsExample() {
    console.log('4. String Operations')
    console.log('=====================')
    
    const template = [
      'Users with "John" in name:',
      '{d.users[name contains \'John\'].email}'
    ].join('\n')

    const data = {
      users: [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' },
        { name: 'Johnny Wilson', email: 'johnny@example.com' },
        { name: 'Bob Johnson', email: 'bob@example.com' }
      ]
    }

    try {
      const result = await this.engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data
      })
      
      console.log('Result:')
      console.log(result.content.toString())
      console.log('Expected: john@example.com, johnny@example.com, bob@example.com\n')
    } catch (error) {
      console.error('Error:', error)
    }
  }

  private async aggregationWithFilteringExample() {
    console.log('5. Aggregation with Filtering')
    console.log('==============================')
    
    const template = [
      'Sales Report:',
      'High-Value Orders (>=$1000): {d.orders[total>=1000][].total:aggSum():round(2)}',
      'Completed Orders Count: {d.orders[status=\'completed\'][].id:aggCount()}',
      'Average Completed Order: $' + '{d.orders[status=\'completed\'][].total:aggAvg():round(2)}'
    ].join('\n')

    const data = {
      orders: [
        { id: 1, status: 'completed', total: 1500 },
        { id: 2, status: 'pending', total: 750 },
        { id: 3, status: 'completed', total: 2000 },
        { id: 4, status: 'completed', total: 500 },
        { id: 5, status: 'cancelled', total: 1200 }
      ]
    }

    try {
      const result = await this.engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data
      })
      
      console.log('Result:')
      console.log(result.content.toString())
      console.log('Expected: High-Value: 3500, Completed: 3, Average: 1333.33\n')
    } catch (error) {
      console.error('Error:', error)
    }
  }

  private async complexExample() {
    console.log('6. Complex Business Scenario')
    console.log('=============================')
    
    const template = [
      '',
      'E-commerce Analytics Report',
      '===========================',
      '',
      'Premium Electronics (>$500):',
      '{d.products[category=\'electronics\'][price>500].name} - $' + '{d.products[category=\'electronics\'][price>500].price}',
      '',
      'Revenue Analysis:',
      '- Electronics Revenue: $' + '{d.products[category=\'electronics\'][].price:aggSum()}',
      '- Premium Electronics Revenue: $' + '{d.products[category=\'electronics\'][price>500][].price:aggSum()}',
      '- Average Electronic Price: $' + '{d.products[category=\'electronics\'][].price:aggAvg():round(2)}',
      '',
      'VIP Customers (orders >$1000):',
      '{d.customers[totalSpent>1000].name:upperCase} - $' + '{d.customers[totalSpent>1000].totalSpent}',
      '',
      'Summary:',
      '- Total VIP Revenue: $' + '{d.customers[totalSpent>1000][].totalSpent:aggSum()}',
      '- VIP Customer Count: {d.customers[totalSpent>1000][].name:aggCount()}'
    ].join('\n')

    const data = {
      products: [
        { name: 'Gaming Laptop', category: 'electronics', price: 1500 },
        { name: 'Wireless Mouse', category: 'electronics', price: 50 },
        { name: '4K Monitor', category: 'electronics', price: 800 },
        { name: 'Office Chair', category: 'furniture', price: 300 },
        { name: 'Mechanical Keyboard', category: 'electronics', price: 150 }
      ],
      customers: [
        { name: 'Alice Johnson', totalSpent: 2500 },
        { name: 'Bob Smith', totalSpent: 750 },
        { name: 'Carol Williams', totalSpent: 1200 },
        { name: 'David Brown', totalSpent: 450 }
      ]
    }

    try {
      const result = await this.engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data
      })
      
      console.log('Result:')
      console.log(result.content.toString())
    } catch (error) {
      console.error('Error:', error)
    }
  }
}

// Runner script
if (require.main === module) {
  const examples = new ArrayFilteringExamples()
  examples.runAllExamples().catch(console.error)
}