// // Create this file as test-advanced.js

// const { TemplateEngine } = require('./dist/handlers/DocumentArrayProcessor');
// const { DocumentFormat } = require('./dist/types/core');

// async function testAdvancedFeatures() {
//   console.log('🔬 Testing Advanced Features...\n');
  
//   try {
//     const engine = new TemplateEngine({
//       performance: {
//         enableMonitoring: true,
//         enableBenchmarking: true
//       },
//       security: {
//         enableValidation: true
//       }
//     });
    
//     // Test 1: Complex template validation
//     console.log('📋 Test 1: Template validation');
//     const template = await engine.parseTemplate({
//       content: `
//         Customer Report
//         ===============
//         Name: {d.customer.name:upperCase}
//         Email: {d.customer.email:lowerCase}
        
//         Orders:
//         {d.orders[i].product} - $${d.orders[i].amount:round(2)}
        
//         Total: $${d.orders[].amount:aggSum():round(2)}
//         Average: $${d.orders[].amount:aggAvg():round(2)}
//       `,
//       format: DocumentFormat.TXT
//     });
    
//     const validation = engine.validateTemplate(template);
//     console.log('Validation result:', validation.valid ? '✅ Valid' : '❌ Invalid');
//     if (validation.warnings.length > 0) {
//       console.log('Warnings:', validation.warnings.map(w => w.message));
//     }
    
//     // Test 2: Performance analysis
//     console.log('\n⚡ Test 2: Performance analysis');
//     const testData = {
//       customer: {
//         name: 'john smith',
//         email: 'JOHN.SMITH@EXAMPLE.COM'
//       },
//       orders: [
//         { product: 'Widget A', amount: 29.99 },
//         { product: 'Widget B', amount: 45.50 },
//         { product: 'Widget C', amount: 12.75 }
//       ]
//     };
    
//     const metrics = await engine.getPerformanceMetrics(template, testData);
//     console.log('Performance metrics:');
//     console.log('- Parse time:', metrics.parsing);
//     console.log('- Process time:', metrics.processing.duration.toFixed(2), 'ms');
//     console.log('- Render time:', metrics.rendering.duration.toFixed(2), 'ms');
//     console.log('- Total time:', metrics.total.duration.toFixed(2), 'ms');
    
//     // Test 3: Template analysis
//     console.log('\n🔍 Test 3: Template analysis');
//     const analysis = engine.analyzeTemplate(template);
//     console.log('Template analysis:');
//     console.log('- Total tags:', analysis.summary.totalTags);
//     console.log('- Array operations:', analysis.summary.arrayIterations + analysis.summary.arrayAggregations);
//     console.log('- Complexity score:', analysis.summary.complexityScore);
//     console.log('- Recommendations:', analysis.recommendations);
    
//     // Test 4: Health check
//     console.log('\n🏥 Test 4: Engine health check');
//     const health = await engine.healthCheck();
//     console.log('Health status:', health.status);
//     console.log('Checks:', health.checks.map(c => `${c.name}: ${c.status}`));
    
//     // Test 5: Statistics
//     console.log('\n📊 Test 5: Engine statistics');
//     const stats = engine.getEngineStats();
//     console.log('Statistics:');
//     console.log('- Total renders:', stats.renders.totalRenders);
//     console.log('- Success rate:', stats.renders.successfulRenders / Math.max(stats.renders.totalRenders, 1) * 100 + '%');
//     console.log('- Average render time:', stats.renders.averageRenderTime.toFixed(2) + 'ms');
    
//     console.log('\n🎉 All advanced tests completed!');
    
//   } catch (error) {
//     console.error('❌ Advanced test failed:', error.message);
//     console.error('Stack:', error.stack);
//   }
// }

// testAdvancedFeatures();