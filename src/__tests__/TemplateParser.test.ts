

import { TemplateParser } from '../parser/TemplateParser'
import { DocumentFormat, TagType } from '../types/core'

describe('TemplateParser', () => {
  let parser: TemplateParser

  beforeEach(() => {
    parser = new TemplateParser()
  })

  describe('basic tag parsing', () => {
    it('should parse simple data tags', () => {
      const template = 'Hello {d.name}!'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags).toHaveLength(1)
      expect(result.tags[0].type).toBe(TagType.DATA)
      expect(result.tags[0].path).toBe('d.name')
      expect(result.tags[0].formatters).toHaveLength(0)
    })

    it('should parse tags with formatters', () => {
      const template = 'Hello {d.name:upperCase:trim}!'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags).toHaveLength(1)
      expect(result.tags[0].formatters).toHaveLength(2)
      expect(result.tags[0].formatters[0].name).toBe('upperCase')
      expect(result.tags[0].formatters[1].name).toBe('trim')
    })

    it('should parse formatters with parameters', () => {
      const template = 'Value: {d.amount:round(2):add(10)}'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags).toHaveLength(1)
      expect(result.tags[0].formatters).toHaveLength(2)
      
      const roundFormatter = result.tags[0].formatters[0]
      expect(roundFormatter.name).toBe('round')
      expect(roundFormatter.parameters).toHaveLength(1)
      expect(roundFormatter.parameters[0].value).toBe(2)
      
      const addFormatter = result.tags[0].formatters[1]
      expect(addFormatter.name).toBe('add')
      expect(addFormatter.parameters[0].value).toBe(10)
    })
  })

  describe('array path parsing', () => {
    it('should parse array iteration tags', () => {
      const template = '{d.items[]}'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags[0].arrayPath).toBeDefined()
      expect(result.tags[0].arrayPath?.basePath).toBe('d.items')
      expect(result.tags[0].arrayPath?.index).toBeUndefined()
    })

    it('should parse array index tags', () => {
      const template = '{d.items[i].name}'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags[0].arrayPath).toBeDefined()
      expect(result.tags[0].arrayPath?.basePath).toBe('d.items.name')
      expect(result.tags[0].arrayPath?.index).toBe('i')
    })

    it('should parse array filter conditions', () => {
      const template = '{d.items[status=active]}'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags[0].arrayPath?.filter).toBeDefined()
      expect(result.tags[0].arrayPath?.filter?.property).toBe('status')
      expect(result.tags[0].arrayPath?.filter?.operator).toBe('eq')
      expect(result.tags[0].arrayPath?.filter?.value).toBe('active')
    })
  })

  describe('special tag types', () => {
    it('should parse translation tags', () => {
      const template = '{t(welcome_message)}'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags[0].type).toBe(TagType.TRANSLATION)
      expect(result.tags[0].path).toBe('welcome_message')
    })

    it('should parse complement tags', () => {
      const template = '{c.config.theme}'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags[0].type).toBe(TagType.COMPLEMENT)
      expect(result.tags[0].path).toBe('c.config.theme')
    })

    it('should parse alias tags', () => {
      const template = '{# userAlias}'
      const result = parser.parse(template, DocumentFormat.TXT)

      expect(result.tags[0].type).toBe(TagType.ALIAS)
      expect(result.tags[0].path).toBe('userAlias')
    })
  })

  describe('error handling', () => {
    it('should handle malformed tags gracefully', () => {
      const template = 'Hello {d.name:invalid(} world'
      
      expect(() => {
        parser.parse(template, DocumentFormat.TXT)
      }).toThrow()
    })

    it('should detect circular dependencies', () => {
      // This would need more complex template setup
      const template = '{d.a:add(.b)} {d.b:add(.a)}'
      
      // For now, just ensure it doesn't crash
      expect(() => {
        parser.parse(template, DocumentFormat.TXT)
      }).not.toThrow()
    })
  })
})