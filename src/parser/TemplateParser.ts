
import { v4 as uuidv4 } from 'uuid'
import { 
  ParsedTemplate, 
  TagInfo, 
  TagType, 
  FormatterCall, 
  FormatterParameter,
  ArrayPath,
  FilterCondition,
  DocumentFormat,
  DependencyGraph,
  DocumentStructure,
  TemplateMetadata,
  TemplateParseError,
  ElementRelationship
} from '../types/core'

export class TemplateParser {
  private static readonly TAG_PATTERN = /\{([^}]+)\}/g
  private static readonly ARRAY_PATTERN = /^(.+?)\[([^\]]*)\](.*)$/
  private static readonly FILTER_PATTERN = /^([^<>=!]+)(>=|<=|>|<|==|!=|=)(.+)$/

  public parse(content: string, format: DocumentFormat): ParsedTemplate {
    try {
      const templateId = uuidv4()
      const tags = this.extractTags(content)
      const dependencies = this.buildDependencyGraph(tags)
      const structure = this.analyzeDocumentStructure(content, tags)
      const metadata = this.extractMetadata(content)

      return {
        id: templateId,
        format,
        content,
        tags,
        dependencies,
        structure,
        metadata
      }
    } catch (error) {
      throw new TemplateParseError(
        `Failed to parse template: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      )
    }
  }

  private extractTags(content: string): TagInfo[] {
    const tags: TagInfo[] = []
    let match: RegExpExecArray | null

    // Reset regex state
    TemplateParser.TAG_PATTERN.lastIndex = 0

    while ((match = TemplateParser.TAG_PATTERN.exec(content)) !== null) {
      try {
        const tagContent = match[1].trim()
        const tagInfo = this.parseTag(tagContent, match.index)
        tags.push(tagInfo)
      } catch (error) {
        throw new TemplateParseError(
          `Invalid tag syntax at position ${match.index}: {${match[1]}}`,
          { position: match.index, tag: match[1] }
        )
      }
    }

    return tags
  }

  private parseTag(tagContent: string, position: number): TagInfo {
    const tagId = uuidv4()
    
    // Determine tag type and extract main content
    const tagType = this.determineTagType(tagContent)
    let mainContent = tagContent

    // Handle special tags
    if (tagType === TagType.TRANSLATION) {
      // {t(key)} format
      const translationMatch = tagContent.match(/^t\((.+)\)$/)
      if (!translationMatch) {
        throw new Error('Invalid translation tag format')
      }
      mainContent = translationMatch[1]
    } else if (tagType === TagType.ALIAS) {
      // {# alias} format
      mainContent = tagContent.substring(1).trim()
    } else if (tagType === TagType.OPTION) {
      // {o.option} format
      mainContent = tagContent.substring(2)
    }

    // Split by colons to separate path from formatters
    const parts = this.splitTagParts(mainContent)
    const path = parts[0]
    const formatterParts = parts.slice(1)

    // Parse array path if present - but keep the original path intact
    const arrayPath = this.parseArrayPath(path)
    
    // Parse formatters
    const formatters = formatterParts.map(part => this.parseFormatter(part))

    return {
      id: tagId,
      type: tagType,
      path: path, // Always keep the original path
      formatters,
      position,
      raw: tagContent,
      arrayPath
    }
  }

  private determineTagType(tagContent: string): TagType {
    if (tagContent.startsWith('d.')) {
      return TagType.DATA
    } else if (tagContent.startsWith('c.')) {
      return TagType.COMPLEMENT
    } else if (tagContent.startsWith('t(') && tagContent.endsWith(')')) {
      return TagType.TRANSLATION
    } else if (tagContent.startsWith('#')) {
      return TagType.ALIAS
    } else if (tagContent.startsWith('o.')) {
      return TagType.OPTION
    } else {
      // Default to data if no prefix
      return TagType.DATA
    }
  }

  private splitTagParts(content: string): string[] {
    const parts: string[] = []
    let current = ''
    let inParentheses = 0
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      const prevChar = i > 0 ? content[i - 1] : ''

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar) {
          inQuotes = false
          quoteChar = ''
        }
      } else if (char === '(' && !inQuotes) {
        inParentheses++
      } else if (char === ')' && !inQuotes) {
        inParentheses--
      } else if (char === ':' && !inQuotes && inParentheses === 0) {
        parts.push(current.trim())
        current = ''
        continue
      }

      current += char
    }

    if (current.trim()) {
      parts.push(current.trim())
    }

    return parts
  }

  private parseArrayPath(path: string): ArrayPath | undefined {
    const match = path.match(TemplateParser.ARRAY_PATTERN)
    if (!match) {
      return undefined
    }

    const basePath = match[1]        // "d.items"
    const indexOrFilter = match[2]   // "0", "i", "", or filter
    const remainingPath = match[3]   // ".name"

    // Only create arrayPath for special cases, not for simple numeric indices
    if (indexOrFilter === '') {
      // Empty brackets: {d.items[]} - aggregation
      return {
        basePath: remainingPath ? `${basePath}${remainingPath}` : basePath
      }
    } else if (indexOrFilter === 'i') {
      // Current index: {d.items[i]} - iteration
      return {
        basePath: remainingPath ? `${basePath}${remainingPath}` : basePath,
        index: 'i'
      }
    } else if (indexOrFilter.match(/^i[+-]\d+$/)) {
      // Relative index: {d.items[i+1]}, {d.items[i-1]} - iteration with offset
      return {
        basePath: remainingPath ? `${basePath}${remainingPath}` : basePath,
        index: indexOrFilter
      }
    } else if (!isNaN(Number(indexOrFilter))) {
      // Numeric index: {d.items[0]} - simple array access, no special handling needed
      return undefined
    } else {
      // Filter condition: {d.items[status=active]} - filtered arrays
      return {
        basePath: remainingPath ? `${basePath}${remainingPath}` : basePath,
        filter: this.parseFilterCondition(indexOrFilter)
      }
    }
  }

  private parseFilterCondition(filterStr: string): FilterCondition {
    const match = filterStr.match(TemplateParser.FILTER_PATTERN)
    if (!match) {
      throw new Error(`Invalid filter condition: ${filterStr}`)
    }

    const property = match[1].trim()
    const operatorStr = match[2].trim()
    const valueStr = match[3].trim()

    // Map string operators to our enum values
    let operator: FilterCondition['operator']
    switch (operatorStr) {
      case '==':
      case '=':
        operator = 'eq'
        break
      case '!=':
        operator = 'ne'
        break
      case '>':
        operator = 'gt'
        break
      case '<':
        operator = 'lt'
        break
      case '>=':
        operator = 'gte'
        break
      case '<=':
        operator = 'lte'
        break
      default:
        throw new Error(`Unsupported operator: ${operatorStr}`)
    }

    // Parse value
    let value: any = valueStr
    if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      value = valueStr.slice(1, -1)
    } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      value = valueStr.slice(1, -1)
    } else if (!isNaN(Number(valueStr))) {
      value = Number(valueStr)
    } else if (valueStr === 'true' || valueStr === 'false') {
      value = valueStr === 'true'
    }

    return {
      property,
      operator,
      value
    }
  }

  private parseFormatter(formatterStr: string): FormatterCall {
    const parenIndex = formatterStr.indexOf('(')
    
    if (parenIndex === -1) {
      // No parameters
      return {
        name: formatterStr,
        parameters: []
      }
    }

    const name = formatterStr.substring(0, parenIndex)
    const paramStr = formatterStr.substring(parenIndex + 1, formatterStr.lastIndexOf(')'))
    
    const parameters = this.parseFormatterParameters(paramStr)

    return {
      name,
      parameters
    }
  }

  private parseFormatterParameters(paramStr: string): FormatterParameter[] {
    if (!paramStr.trim()) {
      return []
    }

    const params: FormatterParameter[] = []
    const parts = this.splitParameters(paramStr)

    for (const part of parts) {
      const trimmed = part.trim()
      
      if (trimmed.startsWith('.')) {
        // Dynamic parameter: relative path
        params.push({
          type: 'dynamic',
          value: trimmed,
          path: trimmed
        })
      } else if (trimmed.startsWith('d.') || trimmed.startsWith('c.')) {
        // Dynamic parameter: absolute path
        params.push({
          type: 'dynamic',
          value: trimmed,
          path: trimmed
        })
      } else {
        // Constant parameter
        let value: any = trimmed
        
        // Parse constant value
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          value = trimmed.slice(1, -1)
        } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
          value = trimmed.slice(1, -1)
        } else if (!isNaN(Number(trimmed))) {
          value = Number(trimmed)
        } else if (trimmed === 'true' || trimmed === 'false') {
          value = trimmed === 'true'
        }

        params.push({
          type: 'constant',
          value
        })
      }
    }

    return params
  }

  private splitParameters(paramStr: string): string[] {
    const params: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''
    let parenLevel = 0

    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i]
      const prevChar = i > 0 ? paramStr[i - 1] : ''

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar) {
          inQuotes = false
          quoteChar = ''
        }
      } else if (char === '(' && !inQuotes) {
        parenLevel++
      } else if (char === ')' && !inQuotes) {
        parenLevel--
      } else if (char === ',' && !inQuotes && parenLevel === 0) {
        params.push(current.trim())
        current = ''
        continue
      }

      current += char
    }

    if (current.trim()) {
      params.push(current.trim())
    }

    return params
  }

  private buildDependencyGraph(tags: TagInfo[]): DependencyGraph {
    const nodes = tags.map(tag => ({
      tagId: tag.id,
      dependencies: this.findTagDependencies(tag, tags),
      dependents: [] as string[]
    }))

    // Build dependents list
    for (const node of nodes) {
      for (const depId of node.dependencies) {
        const depNode = nodes.find(n => n.tagId === depId)
        if (depNode) {
          depNode.dependents.push(node.tagId)
        }
      }
    }

    const edges = nodes.flatMap(node =>
      node.dependencies.map(depId => ({
        from: depId,
        to: node.tagId,
        type: 'data' as const
      }))
    )

    const sortedTags = this.topologicalSort(tags, nodes)

    return {
      nodes,
      edges,
      sortedTags
    }
  }

  private findTagDependencies(tag: TagInfo, allTags: TagInfo[]): string[] {
    const dependencies: string[] = []

    // Check formatter parameters for dynamic references
    for (const formatter of tag.formatters) {
      for (const param of formatter.parameters) {
        if (param.type === 'dynamic' && param.path) {
          // Find tags that resolve this path
          const dependentTags = allTags.filter(t => 
            t.path === param.path || param.path?.startsWith(t.path + '.')
          )
          dependencies.push(...dependentTags.map(t => t.id))
        }
      }
    }

    return [...new Set(dependencies)] // Remove duplicates
  }

  private topologicalSort(tags: TagInfo[], nodes: Array<{ tagId: string; dependencies: string[]; dependents: string[] }>): TagInfo[] {
    const visited = new Set<string>()
    const temp = new Set<string>()
    const result: TagInfo[] = []

    const visit = (tagId: string) => {
      if (temp.has(tagId)) {
        throw new TemplateParseError('Circular dependency detected in template tags')
      }
      
      if (!visited.has(tagId)) {
        temp.add(tagId)
        
        const node = nodes.find(n => n.tagId === tagId)
        if (node) {
          for (const depId of node.dependencies) {
            visit(depId)
          }
        }
        
        temp.delete(tagId)
        visited.add(tagId)
        
        const tag = tags.find(t => t.id === tagId)
        if (tag) {
          result.unshift(tag) // Add to front for reverse topological order
        }
      }
    }

    for (const tag of tags) {
      if (!visited.has(tag.id)) {
        visit(tag.id)
      }
    }

    return result
  }

  private analyzeDocumentStructure(content: string, tags: TagInfo[]): DocumentStructure {
    // Basic implementation - can be enhanced for specific document formats
    const elements = []
    const relationships: ElementRelationship[] = []

    // For now, create a simple text element containing all tags
    elements.push({
      id: uuidv4(),
      type: 'text' as const,
      position: { start: 0, end: content.length },
      content,
      tags: tags.map(t => t.id)
    })

    return {
      elements,
      relationships
    }
  }

  private extractMetadata(content: string): TemplateMetadata {
    const now = new Date()
    
    return {
      created: now,
      modified: now,
      tags: [], // Could extract from comments or special markers
      description: 'Auto-generated template metadata'
    }
  }
}