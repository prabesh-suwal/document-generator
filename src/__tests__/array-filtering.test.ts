import { TemplateEngine } from '../src/engine/TemplateEngine'
import { DocumentFormat } from '../src/types/core'

describe('Array Filtering', () => {
  let engine: TemplateEngine

  beforeEach(() => {
    engine = new TemplateEngine()
  })

  const testData = {
    users: [
      { name: 'John Doe', status: 'active', role: 'admin', age: 30 },
      { name: 'Jane Smith', status: 'inactive', role: 'user', age: 25 },
      { name: 'Bob Johnson', status: 'active', role: 'user', age: 35 }
    ],
    products: [
      { name: 'Laptop', price: 1200, category: 'electronics' },
      { name: 'Mouse', price: 25, category: 'electronics' },
      { name: 'Book', price: 15, category: 'books' }
    ]
  }

  describe('basic filtering', () => {
    it('should filter by string equality', async () => {
      const template = '{d.users[status=\'active\'].name}'
      const result = await engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data: testData
      })
      
      const output = result.content.toString()
      expect(output).toContain('John Doe')
      expect(output).toContain('Bob Johnson')
      expect(output).not.toContain('Jane Smith')
    })

    it('should filter by numeric comparison', async () => {
      const template = '{d.products[price>100].name}'
      const result = await engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data: testData
      })
      
      const output = result.content.toString()
      expect(output).toContain('Laptop')
      expect(output).not.toContain('Mouse')
      expect(output).not.toContain('Book')
    })
  })

  describe('multiple filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const template = '{d.users[status=\'active\'][role=\'admin\'].name}'
      const result = await engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data: testData
      })
      
      const output = result.content.toString()
      expect(output).toContain('John Doe')
      expect(output).not.toContain('Bob Johnson') // active but not admin
      expect(output).not.toContain('Jane Smith')
    })
  })

  describe('string operations', () => {
    it('should filter with contains operation', async () => {
      const template = '{d.users[name contains \'John\'].name}'
      const result = await engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data: testData
      })
      
      const output = result.content.toString()
      expect(output).toContain('John Doe')
      expect(output).toContain('Bob Johnson')
      expect(output).not.toContain('Jane Smith')
    })
  })

  describe('aggregation with filtering', () => {
    it('should count filtered items', async () => {
      const template = '{d.users[status=\'active\'][].name:aggCount()}'
      const result = await engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data: testData
      })
      
      const output = result.content.toString()
      expect(output.trim()).toBe('2')
    })

    it('should sum filtered numeric values', async () => {
      const template = '{d.products[category=\'electronics\'][].price:aggSum()}'
      const result = await engine.render({
        template: { content: template, format: DocumentFormat.TXT },
        data: testData
      })
      
      const output = result.content.toString()
      expect(output.trim()).toBe('1225') // 1200 + 25
    })
  })
})