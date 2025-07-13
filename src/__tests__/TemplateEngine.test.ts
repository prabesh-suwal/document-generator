
import { TemplateEngine, DocumentFormat } from '../index'

describe('TemplateEngine', () => {
  let engine: TemplateEngine

  beforeEach(() => {
    engine = new TemplateEngine()
  })

  it('should render simple templates', async () => {
    const result = await engine.render({
      template: {
        content: 'Hello {d.name}!',
        format: DocumentFormat.TXT
      },
      data: { name: 'World' }
    })

    expect(result.content.toString()).toBe('Hello World!')
  })

  it('should apply formatters correctly', async () => {
    const result = await engine.render({
      template: {
        content: 'Hello {d.name:upperCase}!',
        format: DocumentFormat.TXT
      },
      data: { name: 'world' }
    })

    expect(result.content.toString()).toBe('Hello WORLD!')
  })

  it('should handle mathematical operations', async () => {
    const result = await engine.render({
      template: {
        content: 'Result: {d.value:add(5):mul(2)}',
        format: DocumentFormat.TXT
      },
      data: { value: 10 }
    })

    expect(result.content.toString()).toBe('Result: 30') // (10 + 5) * 2
  })

  it('should handle conditional formatting', async () => {
    const result = await engine.render({
      template: {
        content: 'Status: {d.active:ifTrue("Online", "Offline")}',
        format: DocumentFormat.TXT
      },
      data: { active: true }
    })

    expect(result.content.toString()).toBe('Status: Online')
  })

  it('should handle missing data gracefully', async () => {
    const result = await engine.render({
      template: {
        content: 'Value: {d.missing:ifTrue("Found", "Not Found")}',
        format: DocumentFormat.TXT
      },
      data: {}
    })

    expect(result.content.toString()).toBe('Value: Not Found')
  })

  it('should provide performance metadata', async () => {
    const result = await engine.render({
      template: {
        content: 'Hello {d.name}!',
        format: DocumentFormat.TXT
      },
      data: { name: 'Performance Test' }
    })

    expect(result.metadata.duration).toBeGreaterThan(0)
    expect(result.metadata.templateId).toBeDefined()
    expect(result.metadata.outputSize).toBe(result.content.length)
  })
})