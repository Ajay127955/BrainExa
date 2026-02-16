
const axios = require('axios');

const nvidiaKey = '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';
const apiMessages = [
    { role: 'user', content: 'hi' }
];

async function testNvidia() {
    console.log('Testing NVIDIA Llama 3.1...');
    try {
        const response = await axios.post(
            'https://integrate.api.nvidia.com/v1/chat/completions',
            {
                model: 'meta/llama-3.1-70b-instruct',
                messages: apiMessages,
                temperature: 0.5,
                top_p: 1,
                max_tokens: 1024,
            },
            {
                headers: {
                    'Authorization': `Bearer ${nvidiaKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Response:', response.data.choices[0].message.content);
    } catch (error) {
        console.error('--- API ERROR DETAILS ---');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Status Text:', error.response.statusText);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
            console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error Message:', error.message);
        }
        console.error('--- END ERROR DETAILS ---');
    }
}

testNvidia();
