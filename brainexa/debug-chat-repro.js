const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');
const Conversation = require('./server/models/Conversation');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('DB Connection Error:', err.message);
        process.exit(1);
    }
};

const runDebug = async () => {
    await connectDB();

    try {
        // Mock User ID
        const userId = new mongoose.Types.ObjectId();
        console.log('User ID:', userId);

        // Mock Request Body
        const message = "Hello AI, this is a test.";
        const image = null;
        let conversationId = null; // New conversation

        console.log('--- Step 1: Find or Create Conversation ---');
        let conversation;
        let isNewConversation = false;

        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, userId: userId });
            if (!conversation) {
                console.error('Conversation not found');
                return;
            }
        } else {
            conversation = await Conversation.create({
                userId: userId,
                title: (message.slice(0, 30) + (message.length > 30 ? '...' : '')) || 'New Image Chat',
                messages: []
            });
            isNewConversation = true;
            console.log('New Conversation Created:', conversation._id);
        }

        console.log('--- Step 2: Add User Message ---');
        const userMsg = {
            role: 'user',
            content: message || 'Image uploaded',
            image: image || null,
            timestamp: new Date()
        };
        conversation.messages.push(userMsg);
        console.log('User message pushed.');

        console.log('--- Step 3: Call LLM API ---');
        const nvidiaKey = process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_KIMI_API_KEY;
        const groqApiKey = process.env.GROQ_API_KEY;

        console.log('NVIDIA Key available:', !!nvidiaKey);
        console.log('Groq Key available:', !!groqApiKey);

        let aiResponse = "I'm sorry, I couldn't process that.";
        let apiProvider = '';

        try {
            // Image Generation Check (Pollinations.ai)
            const imagePromptRegex = /(?:generate|create|draw|make) (?:an? )?(?:image|picture|photo) (?:of )?(.+)/i;
            const imageMatch = message && message.match(imagePromptRegex);

            if (imageMatch && !image) {
                console.log('Logic: Image Generation (Pollinations)');
                const prompt = imageMatch[1];
                const encodedPrompt = encodeURIComponent(prompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
                aiResponse = `Here is the image of **${prompt}** you requested:\n\n![${prompt}](${imageUrl})`;
                apiProvider = 'Pollinations.ai';
            } else {
                console.log('Logic: Text/Vision Chat');
                // Prepare messages
                const recentMessages = conversation.messages.slice(-6).map(msg => {
                    if (msg.role === 'user' && msg.image) {
                        return {
                            role: 'user',
                            content: [
                                { type: 'text', text: msg.content },
                                { type: 'image_url', image_url: { url: msg.image } }
                            ]
                        };
                    }
                    return { role: msg.role, content: msg.content };
                });

                recentMessages.unshift({
                    role: 'system',
                    content: `You are Brainexa, a highly advanced AI assistant. Be helpful, accurate, and concise.`
                });

                if (image && nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
                    console.log('Using: NVIDIA Vision');
                    apiProvider = 'NVIDIA Vision';
                    const response = await axios.post(
                        'https://integrate.api.nvidia.com/v1/chat/completions',
                        { model: 'nvidia/neva-22b', messages: recentMessages, temperature: 0.2, max_tokens: 1024 },
                        { headers: { 'Authorization': `Bearer ${nvidiaKey}`, 'Content-Type': 'application/json' } }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else if (image && groqApiKey) {
                    console.log('Using: Groq Vision');
                    apiProvider = 'Groq Vision';
                    const response = await axios.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        { model: 'llama-3.2-11b-vision-preview', messages: recentMessages, temperature: 0.2, max_tokens: 1024 },
                        { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else if (nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
                    console.log('Using: NVIDIA Llama 3.1');
                    apiProvider = 'NVIDIA Llama 3.1';
                    // Sanitize
                    const textOnlyMessages = recentMessages.map(msg => {
                        if (Array.isArray(msg.content)) {
                            const textPart = msg.content.find(c => c.type === 'text');
                            return { ...msg, content: textPart ? textPart.text : '(Image)' };
                        }
                        return msg;
                    });

                    console.log('Sending request to NVIDIA...');
                    const response = await axios.post(
                        'https://integrate.api.nvidia.com/v1/chat/completions',
                        { model: 'meta/llama-3.1-70b-instruct', messages: textOnlyMessages, temperature: 0.5, max_tokens: 1024 },
                        { headers: { 'Authorization': `Bearer ${nvidiaKey}`, 'Content-Type': 'application/json' } }
                    );
                    console.log('NVIDIA Response Status:', response.status);
                    aiResponse = response.data.choices[0].message.content;
                } else if (groqApiKey) {
                    console.log('Using: Groq');
                    apiProvider = 'Groq';
                    const response = await axios.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        { model: 'llama3-8b-8192', messages: recentMessages, temperature: 0.5 },
                        { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else {
                    console.log('No valid API Configuration found.');
                    aiResponse = "No valid API Configuration found.";
                }
            }

        } catch (apiError) {
            console.error('API Error details:', apiError.response ? apiError.response.data : apiError.message);
            aiResponse = `Error: ${apiError.message}`;
        }

        console.log('--- Step 4: Save AI Response ---');
        console.log('AI Response:', aiResponse);

        conversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date()
        });

        await conversation.save();
        console.log('Conversation Saved Successfully!');

        console.log('Result:', aiResponse);

    } catch (error) {
        console.error('CRASHED at Outer Block:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runDebug();
