import { promises as fs } from 'fs'
import path from 'path'

export async function debugFiles() {
  console.log('🔍 Debugging File Structure\n')
  
  const checkPaths = [
    'src/engine/TemplateEngine.ts',
    'src/types/core.ts', 
    'src/parser/TemplateParser.ts',
    'src/processor/DataProcessor.ts',
    'src/renderer/RendererEngine.ts',
    'src/formatters/FormatterRegistry.ts',
    'dist/engine/TemplateEngine.js',
    'dist/examples/',
    'output/'
  ]
  
  for (const checkPath of checkPaths) {
    try {
      const stats = await fs.stat(checkPath)
      const type = stats.isDirectory() ? 'DIR' : 'FILE'
      const size = stats.isFile() ? `(${stats.size} bytes)` : ''
      console.log(`✅ ${type}: ${checkPath} ${size}`)
    } catch (error) {
      console.log(`❌ MISSING: ${checkPath}`)
    }
  }
  
  // Check if output directory is writable
  try {
    await fs.mkdir('output', { recursive: true })
    await fs.writeFile('output/test.txt', 'test')
    await fs.unlink('output/test.txt')
    console.log('✅ Output directory is writable')
  } catch (error) {
    console.log(`❌ Cannot write to output directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

if (require.main === module) {
  debugFiles()
}