
import { FormatterRegistry } from '../formatters/FormatterRegistry'
import { UpperCaseFormatter, AddFormatter } from '../formatters'

describe('FormatterRegistry', () => {
  let registry: FormatterRegistry

  beforeEach(() => {
    registry = new FormatterRegistry()
    registry.register(new UpperCaseFormatter())
    registry.register(new AddFormatter())
  })

  it('should register and retrieve formatters', () => {
    expect(registry.has('upperCase')).toBe(true)
    expect(registry.has('add')).toBe(true)
    expect(registry.has('nonexistent')).toBe(false)
  })

  it('should execute simple formatter chains', () => {
    const chain = [
      { name: 'upperCase', parameters: [] }
    ]

    const result = registry.executeChain('hello world', chain)
    expect(result).toBe('HELLO WORLD')
  })

  it('should execute complex formatter chains', () => {
    const chain = [
      { name: 'add', parameters: [{ type: 'constant' as const, value: 5 }] },
      { name: 'add', parameters: [{ type: 'constant' as const, value: 3 }] }
    ]

    const result = registry.executeChain(10, chain)
    expect(result).toBe(18) // 10 + 5 + 3
  })

  it('should validate formatter chains', () => {
    const validChain = [
      { name: 'upperCase', parameters: [] }
    ]

    const invalidChain = [
      { name: 'nonexistent', parameters: [] }
    ]

    expect(registry.validateChain(validChain).valid).toBe(true)
    expect(registry.validateChain(invalidChain).valid).toBe(false)
  })
})
