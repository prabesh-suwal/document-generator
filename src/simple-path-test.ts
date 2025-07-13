
import { TemplateEngine } from './index'

// Create a simple test to debug path resolution
function testPathResolution() {
  console.log('🔍 Path Resolution Debug...')
  
  const data = {
    items: [
      { name: 'Laptop', price: 1299.99 },
      { name: 'Mouse', price: 25.99 }
    ]
  }
  
  // Simulate the path resolution manually
  function resolvePath(path: string, data: any): any {
    console.log(`\n--- Resolving path: "${path}" ---`)
    
    if (!path) return data

    let actualPath = path
    if (path.startsWith('d.')) {
      actualPath = path.substring(2)
      console.log(`After removing 'd.': "${actualPath}"`)
    }

    // Split by dots
    const parts = actualPath.split('.')
    console.log(`Split into parts:`, parts)
    
    let current = data
    console.log(`Starting with data:`, JSON.stringify(data, null, 2))

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      console.log(`\nProcessing part ${i}: "${part}"`)
      console.log(`Current value:`, current)
      
      if (current == null) {
        console.log(`Current is null/undefined, returning undefined`)
        return undefined
      }
      
      // Handle array notation
      if (part.includes('[') && part.includes(']')) {
        console.log(`Part contains array notation`)
        const arrayMatch = part.match(/^(.+)\[(\d+|i)\]$/)
        if (arrayMatch) {
          const arrayName = arrayMatch[1]
          const index = arrayMatch[2]
          console.log(`Array name: "${arrayName}", index: "${index}"`)
          
          current = current[arrayName]
          console.log(`After getting array "${arrayName}":`, current)
          
          if (Array.isArray(current)) {
            if (index !== 'i') {
              const numIndex = parseInt(index)
              console.log(`Getting item at index ${numIndex}`)
              if (!isNaN(numIndex) && numIndex >= 0 && numIndex < current.length) {
                current = current[numIndex]
                console.log(`Item at index ${numIndex}:`, current)
              } else {
                console.log(`Invalid index ${numIndex}`)
                return undefined
              }
            }
          } else {
            console.log(`"${arrayName}" is not an array`)
            return undefined
          }
        } else {
          console.log(`Array notation didn't match regex`)
          current = current[part]
        }
      } else {
        console.log(`Regular property access for "${part}"`)
        current = current[part]
        console.log(`After accessing "${part}":`, current)
      }
    }

    console.log(`Final result:`, current)
    return current
  }

  // Test different paths
  console.log('\n=== Test 1: d.items ===')
  resolvePath('d.items', data)
  
  console.log('\n=== Test 2: d.items[0] ===')
  resolvePath('d.items[0]', data)
  
  console.log('\n=== Test 3: d.items[0].name ===')
  resolvePath('d.items[0].name', data)
}

if (require.main === module) {
  testPathResolution()
}

export { testPathResolution }