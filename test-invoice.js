const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testInvoiceTemplate() {
    try {
        console.log('🧪 Testing Invoice Template...');
        
        // Read template file
        const templateBuffer = fs.readFileSync('./invoice-template.docx');
        
        // Test data
        const testData = {
            invoice: {
                number: "INV-2024-001",
                date: "2024-01-15",
                dueDate: "2024-02-15"
            },
            customer: {
                name: "John Doe",
                address: "123 Main Street",
                city: "New York",
                state: "NY",
                zipCode: "10001",
                email: "john.doe@email.com"
            },
            shipping: {
                name: "John Doe",
                address: "123 Main Street",
                city: "New York",
                state: "NY",
                zipCode: "10001",
                cost: 15.00
            },
            items: [
                {
                    description: "Laptop Computer",
                    quantity: 1,
                    unitPrice: 999.99
                },
                {
                    description: "Wireless Mouse",
                    quantity: 2,
                    unitPrice: 25.99
                },
                {
                    description: "USB-C Hub",
                    quantity: 1,
                    unitPrice: 79.99
                }
            ],
            tax: {
                rate: 0.08
            },
            total: 1163.95,
            payment: {
                terms: "Net 30 days. Payment due within 30 days of invoice date."
            },
            notes: "Please include invoice number on your payment. Thank you for choosing our services!"
        };
        
        // Test 1: Render as DOCX
        await testRender(templateBuffer, testData, 'docx', 'invoice-output.docx');
        
        // Test 2: Render as PDF
        await testRender(templateBuffer, testData, 'pdf', 'invoice-output.pdf');
        
        // Test 3: Render as HTML
        await testRender(templateBuffer, testData, 'html', 'invoice-output.html');
        
        console.log('✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

async function testRender(templateBuffer, data, format, outputFile) {
    try {
        console.log(`\n📄 Testing ${format.toUpperCase()} rendering...`);
        
        const formData = new FormData();
        formData.append('template', templateBuffer, 'invoice-template.docx');
        formData.append('data', JSON.stringify(data));
        formData.append('options', JSON.stringify({ convertTo: format }));
        
        const response = await axios.post('http://localhost:3000/api/render-docx', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            responseType: 'arraybuffer'
        });
        
        fs.writeFileSync(outputFile, Buffer.from(response.data));
        console.log(`✅ ${format.toUpperCase()} rendered successfully: ${outputFile}`);
        
    } catch (error) {
        console.error(`❌ ${format.toUpperCase()} rendering failed:`, error.response?.data || error.message);
    }
}
