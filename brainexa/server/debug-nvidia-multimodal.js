
const axios = require('axios');

const nvidiaKey = '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';

// Simulate history with an image (multimodal format)
const apiMessages = [
    {
        role: 'user',
        content: [
            { type: 'text', text: 'Analyze this image' },
            { type: 'image_url', image_url: { url: 'https://via.placeholder.com/150' } }
        ]
    },
    { role: 'assistant', content: 'This is a placeholder image.' },
    { role: 'user', content: 'hi' }
];

async function testNvidia() {
    console.log('Testing NVIDIA Llama 3.1 with Multimodal History...');
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
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

testNvidia();
