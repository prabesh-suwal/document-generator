
import { ArrayRegion } from '../types/core'
import { DocumentStructure, DocumentStructureMap, TagPosition } from '../types/document'

export class DocumentContentInjector {
  /**
   * Main injection method - injects processed content back into document structure
   */
  public static injectProcessedContent(
    originalStructure: DocumentStructure,
    processedText: string,
    tagMappings: Map<string, TagPosition>,
    structureMap: DocumentStructureMap,
    resolvedValues: Map<string, any>
  ): DocumentStructure {
    const newStructure = JSON.parse(JSON.stringify(originalStructure))

    switch (newStructure.type) {
      case 'xml':
        this.injectIntoXML(newStructure.root, processedText, tagMappings, resolvedValues)
        break
      case 'office':
        this.injectIntoOfficeDocument(newStructure.root, processedText, structureMap, resolvedValues)
        break
      case 'html':
        this.injectIntoHTML(newStructure, processedText)
        break
      default:
        newStructure.root = processedText
    }

    return newStructure
  }

  /**
   * Inject into Office documents with proper structure preservation
   */
  private static injectIntoOfficeDocument(
    officeDoc: any,
    processedText: string,
    structureMap: DocumentStructureMap,
    resolvedValues: Map<string, any>
  ): void {
    if (officeDoc['w:document']) {
      // Word document injection
      this.injectIntoWordDocument(officeDoc['w:document'], processedText, structureMap, resolvedValues)
    } else if (officeDoc.worksheets) {
      // Excel workbook injection
      this.injectIntoExcelWorkbook(officeDoc.worksheets, processedText, structureMap, resolvedValues)
    }
  }

  /**
   * Inject into Word document structure
   */
  private static injectIntoWordDocument(
    wordDoc: any,
    processedText: string,
    structureMap: DocumentStructureMap,
    resolvedValues: Map<string, any>
  ): void {
    const lines = processedText.split('\n')
    
    // Process array regions first (these may duplicate paragraphs)
    for (const arrayRegion of structureMap.arrayRegions) {
      this.handleArrayRegionInWord(wordDoc, arrayRegion, lines, resolvedValues)
    }
    
    // Then process individual text nodes
    for (const textNode of structureMap.textNodes) {
      if (textNode.line < lines.length) {
        const newText = lines[textNode.line] || ''
        this.updateWordTextNode(textNode.nodeRef, newText)
      }
    }
  }

  /**
   * Handle array regions in Word documents - duplicate paragraphs
   */
  private static handleArrayRegionInWord(
    wordDoc: any,
    arrayRegion: ArrayRegion,
    lines: string[],
    resolvedValues: Map<string, any>
  ): void {
    // Find the paragraph containing the array iteration
    const paragraph = this.findWordParagraphByPath(wordDoc, arrayRegion.elementPath)
    
    if (paragraph && paragraph.parent && paragraph.index !== undefined) {
      // Get array data length to determine how many paragraphs to create
      const arrayData = this.getArrayDataFromResolvedValues(arrayRegion.arrayPath, resolvedValues)
      
      if (Array.isArray(arrayData) && arrayData.length > 0) {
        // Remove original paragraph
        paragraph.parent.splice(paragraph.index, 1)
        
        // Insert duplicated paragraphs for each array item
        for (let i = 0; i < arrayData.length; i++) {
          const duplicatedParagraph = JSON.parse(JSON.stringify(paragraph.element))
          
          // Update the text content with processed line
          const lineIndex = arrayRegion.startLine + i
          if (lineIndex < lines.length) {
            this.updateTextInWordParagraph(duplicatedParagraph, lines[lineIndex])
          }
          
          paragraph.parent.splice(paragraph.index + i, 0, duplicatedParagraph)
        }
      }
    }
  }

  /**
   * Inject into Excel workbook
   */
  private static injectIntoExcelWorkbook(
    worksheets: any[],
    processedText: string,
    structureMap: DocumentStructureMap,
    resolvedValues: Map<string, any>
  ): void {
    const lines = processedText.split('\n')
    
    // Process array regions first
    for (const arrayRegion of structureMap.arrayRegions) {
      this.handleArrayRegionInExcel(worksheets, arrayRegion, lines, resolvedValues)
    }
    
    // Then process individual text nodes
    for (const textNode of structureMap.textNodes) {
      if (textNode.nodeRef && textNode.nodeRef.sheet && textNode.line < lines.length) {
        const newText = lines[textNode.line] || ''
        const cellValue = newText.split('\t')[textNode.nodeRef.col] || ''
        
        // Update the cell value
        textNode.nodeRef.sheet.data[textNode.nodeRef.row][textNode.nodeRef.col] = cellValue
      }
    }
  }

  /**
   * Handle array regions in Excel - duplicate rows
   */
  private static handleArrayRegionInExcel(
    worksheets: any[],
    arrayRegion: ArrayRegion,
    lines: string[],
    resolvedValues: Map<string, any>
  ): void {
    // Find the worksheet and row
    const worksheet = this.findWorksheetByPath(worksheets, arrayRegion.elementPath)
    
    if (worksheet) {
      const arrayData = this.getArrayDataFromResolvedValues(arrayRegion.arrayPath, resolvedValues)
      
      if (Array.isArray(arrayData) && arrayData.length > 0) {
        const rowIndex = this.extractRowIndexFromPath(arrayRegion.elementPath)
        
        if (rowIndex !== -1 && worksheet.data[rowIndex]) {
          const originalRow = worksheet.data[rowIndex]
          
          // Remove original row
          worksheet.data.splice(rowIndex, 1)
          
          // Insert duplicated rows
          for (let i = 0; i < arrayData.length; i++) {
            const duplicatedRow = JSON.parse(JSON.stringify(originalRow))
            
            // Update row with processed data
            const lineIndex = arrayRegion.startLine + i
            if (lineIndex < lines.length) {
              const rowData = lines[lineIndex].split('\t')
              for (let colIdx = 0; colIdx < duplicatedRow.length; colIdx++) {
                if (colIdx < rowData.length) {
                  duplicatedRow[colIdx] = rowData[colIdx]
                }
              }
            }
            
            worksheet.data.splice(rowIndex + i, 0, duplicatedRow)
          }
        }
      }
    }
  }

  /**
   * Inject into HTML content
   */
  private static injectIntoHTML(structure: DocumentStructure, processedText: string): void {
    structure.root = processedText
  }

  /**
   * Inject into XML content
   */
  private static injectIntoXML(
    xmlRoot: any,
    processedText: string,
    tagMappings: Map<string, TagPosition>,
    resolvedValues: Map<string, any>
  ): void {
    // For XML, we'll replace the content directly
    // In a more sophisticated implementation, we'd preserve the XML structure
    // and only replace text nodes
  }

  // Helper methods
  private static updateWordTextNode(nodeRef: any, newText: string): void {
    if (nodeRef && nodeRef['w:t'] !== undefined) {
      nodeRef['w:t'] = newText
    }
  }

  private static findWordParagraphByPath(wordDoc: any, elementPath: string[]): any {
    // Implementation to find Word paragraph by element path
    return null // Simplified for now
  }

  private static updateTextInWordParagraph(paragraph: any, newText: string): void {
    // Implementation to update text in Word paragraph
  }

  private static findWorksheetByPath(worksheets: any[], elementPath: string[]): any {
    // Find worksheet by name from element path
    const sheetName = elementPath[1] // Assuming path is ['worksheets', 'SheetName', ...]
    return worksheets.find(sheet => sheet.name === sheetName)
  }

  private static extractRowIndexFromPath(elementPath: string[]): number {
    // Extract row index from element path
    const rowStr = elementPath[3] // Assuming path is ['worksheets', 'SheetName', 'data', '0', ...]
    return parseInt(rowStr, 10) || -1
  }

  private static getArrayDataFromResolvedValues(arrayPath: string, resolvedValues: Map<string, any>): any[] {
    // Get array data from resolved values map
    // This would need to be implemented based on how you store resolved array data
    return []
  }
}
