const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function renderDocxTemplate() {
    try {
        // Read template file
        const templateBuffer = fs.readFileSync('path/to/your/template.docx');
        
        // Prepare form data
        const formData = new FormData();
        formData.append('template', templateBuffer, 'template.docx');
        formData.append('data', JSON.stringify({
            customerName: 'John Doe',
            items: [
                { name: 'Laptop', quantity: 1, price: 999.99 },
                { name: 'Mouse', quantity: 2, price: 25.99 }
            ],
            total: 1051.97
        }));
        formData.append('options', JSON.stringify({
            convertTo: 'docx'
        }));
        
        // Make request
        const response = await axios.post('http://localhost:3000/api/render-docx', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            responseType: 'arraybuffer'
        });
        
        // Save result
        fs.writeFileSync('output.docx', Buffer.from(response.data));
        console.log('✅ Document rendered successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

// Alternative: JSON-based API
async function renderDocxTemplateJson() {
    try {
        const templateBuffer = fs.readFileSync('path/to/your/template.docx');
        const templateBase64 = templateBuffer.toString('base64');
        
        const response = await axios.post('http://localhost:3000/api/render-docx-json', {
            template: {
                content: templateBase64,
                format: 'docx'
            },
            data: {
                customerName: 'John Doe',
                items: [
                    { name: 'Laptop', quantity: 1, price: 999.99 },
                    { name: 'Mouse', quantity: 2, price: 25.99 }
                ]
            },
            options: {
                convertTo: 'docx'
            }
        });
        
        if (response.data.success) {
            const outputBuffer = Buffer.from(response.data.data.content, 'base64');
            fs.writeFileSync('output.docx', outputBuffer);
            console.log('✅ Document rendered successfully!');
            console.log('Metadata:', response.data.data.metadata);
        } else {
            console.error('❌ Error:', response.data.error);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}
