
import { DocumentStructure, ContentExtractionResult, TagPosition, DocumentStructureMap } from '../types/document'
import { ArrayRegion, TagInfo, TextNodeInfo } from '../types/core'

export class DocumentContentExtractor {
  /**
   * Main extraction method - extracts template content while preserving structure
   */
  public static extractTemplateContent(structure: DocumentStructure): ContentExtractionResult {
    let tagMappings = new Map<string, TagPosition>()  // Change const to let
        let templateContent = ''
    let structureMap: DocumentStructureMap
    
    switch (structure.type) {
      case 'xml':
        ({ templateContent, tagMappings, structureMap } = this.extractFromXML(structure.root))
        break
      case 'office':
        ({ templateContent, tagMappings, structureMap } = this.extractFromOfficeDocument(structure.root))
        break
      case 'html':
        ({ templateContent, tagMappings, structureMap } = this.extractFromHTML(structure.root))
        break
      default:
        templateContent = String(structure.root)
        structureMap = { textNodes: [], arrayRegions: [], formatting: [] }
    }
    
    return {
      templateContent,
      tagMappings,
      structureMap
    }
  }

  /**
   * Extract from Office documents (Word/Excel)
   */
  private static extractFromOfficeDocument(officeDoc: any): {
    templateContent: string
    tagMappings: Map<string, TagPosition>
    structureMap: DocumentStructureMap
  } {
    const tagMappings = new Map<string, TagPosition>()
    const textNodes: TextNodeInfo[] = []
    const arrayRegions: ArrayRegion[] = []
    
    if (officeDoc['w:document']) {
      // Word document extraction
      return this.extractFromWordDocument(officeDoc['w:document'])
    } else if (officeDoc.worksheets) {
      // Excel workbook extraction
      return this.extractFromExcelWorkbook(officeDoc.worksheets)
    }
    
    return {
      templateContent: '',
      tagMappings,
      structureMap: { textNodes, arrayRegions, formatting: [] }
    }
  }

  /**
   * Extract from Word document structure
   */
  private static extractFromWordDocument(wordDoc: any): {
    templateContent: string
    tagMappings: Map<string, TagPosition>
    structureMap: DocumentStructureMap
  } {
    const textParts: string[] = []
    const tagMappings = new Map<string, TagPosition>()
    const textNodes: TextNodeInfo[] = []
    const arrayRegions: ArrayRegion[] = []
    let lineNumber = 0
    
    this.traverseWordNodes(wordDoc, textParts, tagMappings, textNodes, arrayRegions, lineNumber, [])
    
    return {
      templateContent: textParts.join('\n'),
      tagMappings,
      structureMap: { textNodes, arrayRegions, formatting: [] }
    }
  }

  /**
   * Traverse Word document nodes and extract text with position tracking
   */
  private static traverseWordNodes(
    node: any,
    textParts: string[],
    tagMappings: Map<string, TagPosition>,
    textNodes: TextNodeInfo[],
    arrayRegions: ArrayRegion[],
    lineNumber: number,
    elementPath: string[]
  ): number {
    if (typeof node === 'string') {
      textParts.push(node)
      this.extractTagsFromText(node, lineNumber, 0, elementPath, tagMappings)
      return lineNumber
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        lineNumber = this.traverseWordNodes(
          node[i], 
          textParts, 
          tagMappings, 
          textNodes, 
          arrayRegions, 
          lineNumber, 
          [...elementPath, `[${i}]`]
        )
      }
      return lineNumber
    }

    if (typeof node === 'object' && node !== null) {
      // Word paragraph - new line
      if (node['w:p']) {
        lineNumber++
        textParts.push('') // Add line break
      }
      
      // Word text node
      if (node['w:t']) {
        const text = node['w:t']
        textParts.push(text)
        
        // Track text node for later injection
        textNodes.push({
          text,
          line: lineNumber,
          elementPath: [...elementPath],
          nodeRef: node
        })
        
        // Check for array iteration tags
        if (text.includes('[i]')) {
          arrayRegions.push({
            startLine: lineNumber,
            endLine: lineNumber,
            arrayPath: this.extractArrayPath(text),
            elementPath: [...elementPath]
          })
        }
        
        this.extractTagsFromText(text, lineNumber, 0, elementPath, tagMappings)
      }
      
      // Recursively process all properties
      Object.keys(node).forEach((key, index) => {
        lineNumber = this.traverseWordNodes(
          node[key], 
          textParts, 
          tagMappings, 
          textNodes, 
          arrayRegions, 
          lineNumber, 
          [...elementPath, key]
        )
      })
    }

    return lineNumber
  }

  /**
   * Extract from Excel workbook
   */
  private static extractFromExcelWorkbook(worksheets: any[]): {
    templateContent: string
    tagMappings: Map<string, TagPosition>
    structureMap: DocumentStructureMap
  } {
    const textParts: string[] = []
    const tagMappings = new Map<string, TagPosition>()
    const textNodes: TextNodeInfo[] = []
    const arrayRegions: ArrayRegion[] = []
    let lineNumber = 0
    
    for (const sheet of worksheets) {
      textParts.push(`=== ${sheet.name} ===`)
      lineNumber++
      
      if (sheet.data && Array.isArray(sheet.data)) {
        for (let rowIdx = 0; rowIdx < sheet.data.length; rowIdx++) {
          const row = sheet.data[rowIdx]
          const rowText = row.map((cell: any) => String(cell || '')).join('\t')
          textParts.push(rowText)
          
          // Track cells with tags
          for (let colIdx = 0; colIdx < row.length; colIdx++) {
            const cellValue = String(row[colIdx] || '')
            if (cellValue.includes('{')) {
              textNodes.push({
                text: cellValue,
                line: lineNumber,
                elementPath: ['worksheets', sheet.name, 'data', rowIdx.toString(), colIdx.toString()],
                nodeRef: { sheet, row: rowIdx, col: colIdx }
              })
              
              this.extractTagsFromText(cellValue, lineNumber, colIdx, 
                ['worksheets', sheet.name, 'data', rowIdx.toString(), colIdx.toString()], 
                tagMappings)
              
              // Check for array iteration
              if (cellValue.includes('[i]')) {
                arrayRegions.push({
                  startLine: lineNumber,
                  endLine: lineNumber,
                  arrayPath: this.extractArrayPath(cellValue),
                  elementPath: ['worksheets', sheet.name, 'data', rowIdx.toString()]
                })
              }
            }
          }
          
          lineNumber++
        }
      }
    }
    
    return {
      templateContent: textParts.join('\n'),
      tagMappings,
      structureMap: { textNodes, arrayRegions, formatting: [] }
    }
  }

  /**
   * Extract from HTML content
   */
  private static extractFromHTML(htmlRoot: any): {
    templateContent: string
    tagMappings: Map<string, TagPosition>
    structureMap: DocumentStructureMap
  } {
    const htmlContent = typeof htmlRoot === 'string' ? htmlRoot : htmlRoot.toString()
    const tagMappings = new Map<string, TagPosition>()
    const lines = htmlContent.split('\n')
    
    // Extract tags from HTML
lines.forEach((line: string, index: number) => {
        this.extractTagsFromText(line, index, 0, ['html'], tagMappings)
    })
    
    return {
      templateContent: htmlContent,
      tagMappings,
      structureMap: { textNodes: [], arrayRegions: [], formatting: [] }
    }
  }

  /**
   * Extract from generic XML
   */
  private static extractFromXML(xmlRoot: any): {
    templateContent: string
    tagMappings: Map<string, TagPosition>
    structureMap: DocumentStructureMap
  } {
    const textParts: string[] = []
    const tagMappings = new Map<string, TagPosition>()
    
    this.traverseXMLNodes(xmlRoot, textParts, tagMappings, 0, [])
    
    return {
      templateContent: textParts.join(''),
      tagMappings,
      structureMap: { textNodes: [], arrayRegions: [], formatting: [] }
    }
  }

  private static traverseXMLNodes(
    node: any,
    textParts: string[],
    tagMappings: Map<string, TagPosition>,
    lineNumber: number,
    elementPath: string[]
  ): number {
    if (typeof node === 'string') {
      textParts.push(node)
      this.extractTagsFromText(node, lineNumber, 0, elementPath, tagMappings)
      return lineNumber
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        lineNumber = this.traverseXMLNodes(item, textParts, tagMappings, lineNumber, [...elementPath, `[${index}]`])
      })
      return lineNumber
    }

    if (typeof node === 'object' && node !== null) {
      Object.keys(node).forEach(key => {
        lineNumber = this.traverseXMLNodes(node[key], textParts, tagMappings, lineNumber, [...elementPath, key])
      })
    }

    return lineNumber
  }

  /**
   * Extract template tags from text and record their positions
   */
  private static extractTagsFromText(
    text: string,
    line: number,
    column: number,
    elementPath: string[],
    tagMappings: Map<string, TagPosition>
  ): void {
    const tagPattern = /\{([^}]+)\}/g
    let match: RegExpExecArray | null

    while ((match = tagPattern.exec(text)) !== null) {
      const fullTag = match[0]
      const tagContent = match[1]
      
      tagMappings.set(fullTag, {
        line,
        column: column + match.index,
        context: text,
        elementPath: [...elementPath]
      })
    }
  }

  /**
   * Extract array path from text containing array notation
   */
  private static extractArrayPath(text: string): string {
    const match = text.match(/\{d\.([^[]+)\[/)
    return match ? `d.${match[1]}` : ''
  }
}