const express = require('express');
const router = express.Router();
const axios = require('axios');
const Chat = require('../models/Chat');
const { protect } = require('../middleware/authMiddleware');

// @desc    Send message to AI
// @route   POST /api/chat
// @access  Private
router.post('/', protect, async (req, res) => {
    const { message, image } = req.body;

    if (!message && !image) {
        return res.status(400).json({ message: 'Message or Image is required' });
    }

    try {
        // 1. Save User Message
        let chat = await Chat.findOne({ userId: req.user._id });

        if (!chat) {
            chat = await Chat.create({
                userId: req.user._id,
                messages: []
            });
        }

        chat.messages.push({
            role: 'user',
            content: message || 'Image uploaded',
            image: image || null
        });

        // 2. Call LLM API (Vision Support)
        const nvidiaKey = process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_KIMI_API_KEY; // Using any available NVIDIA Key
        const groqApiKey = process.env.GROQ_API_KEY;

        let aiResponse = "I'm sorry, I couldn't process that.";
        let apiProvider = '';

        try {
            // Image Generation Check (Pollinations.ai)
            const imagePromptRegex = /(?:generate|create|draw|make) (?:an? )?(?:image|picture|photo) (?:of )?(.+)/i;
            const imageMatch = message.match(imagePromptRegex);

            if (imageMatch && !image) { // Only if text prompt implies image gen and NO image is uploaded
                const prompt = imageMatch[1];
                const encodedPrompt = encodeURIComponent(prompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

                aiResponse = `Here is the image of **${prompt}** you requested:\n\n![${prompt}](${imageUrl})`;

                // Skip LLM call
                apiProvider = 'Pollinations.ai';
            } else {

                // Construct Messages History for API
                const apiMessages = chat.messages.map(msg => {
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

                // Add System Prompt
                apiMessages.unshift({
                    role: 'system',
                    content: `You are Brainexa, a highly advanced AI assistant. 
                
                Your core expertise includes:
                1. **Global Knowledge**: You have access to information about the world, history, geography, and cultures.
                2. **Computer Science**: You are an expert in computers, programming, software development, and hardware.
                3. **New Technologies**: You stay up-to-date with emerging tech like AI, Blockchain, Quantum Computing, and IoT.
                4. **Mobile Technology**: You are knowledgeable about smartphones, mobile operating systems (iOS, Android), and mobile app development.
                
                Be helpful, accurate, and concise. formatting your responses with Markdown.
                If asked to generate an image, you can't do it directly, but the system will handle it if the user starts their sentence with "generate an image of...".`
                });

                if (image && nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
                    // NVIDIA Vision (Neva)
                    apiProvider = 'NVIDIA Vision';
                    const response = await axios.post(
                        'https://integrate.api.nvidia.com/v1/chat/completions',
                        {
                            model: 'nvidia/neva-22b',
                            messages: apiMessages,
                            temperature: 0.2,
                            top_p: 0.7,
                            max_tokens: 1024,
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${nvidiaKey}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else if (image && groqApiKey) {
                    // Groq Vision (Llama 3.2)
                    apiProvider = 'Groq Vision';
                    const response = await axios.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        {
                            model: 'llama-3.2-11b-vision-preview',
                            messages: apiMessages,
                            temperature: 0.2,
                            max_tokens: 1024,
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${groqApiKey}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    aiResponse = response.data.choices[0].message.content;

                } else if (nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
                    // Standard Text Chat (NVIDIA)
                    apiProvider = 'NVIDIA Llama 3.1';

                    // Sanitize messages for text-only model (remove image arrays)
                    const textOnlyMessages = apiMessages.map(msg => {
                        if (Array.isArray(msg.content)) {
                            // Extract text from content array
                            const textPart = msg.content.find(c => c.type === 'text');
                            return { ...msg, content: textPart && textPart.text ? textPart.text : '(Image)' };
                        }
                        return msg;
                    });

                    const response = await axios.post(
                        'https://integrate.api.nvidia.com/v1/chat/completions',
                        {
                            model: 'meta/llama-3.1-70b-instruct',
                            messages: textOnlyMessages, // Use sanitized messages
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
                    aiResponse = response.data.choices[0].message.content;

                } else if (groqApiKey) {
                    // Standard Text Chat (Groq)
                    apiProvider = 'Groq';
                    const response = await axios.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        {
                            model: 'llama3-8b-8192',
                            messages: apiMessages,
                            temperature: 0.5,
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${groqApiKey}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else {
                    aiResponse = "No valid API Configuration found for this request.";
                }
            } // End of Image Gen else block

        } catch (apiError) {
            console.error(`${apiProvider} API Error:`, apiError.response ? apiError.response.data : apiError.message);
            const errorMessage = apiError.response?.data?.error?.message || apiError.message || 'Unknown error';
            aiResponse = `Error processing request with ${apiProvider}: ${errorMessage}`;
        }

        // 3. Save AI Response
        chat.messages.push({
            role: 'assistant',
            content: aiResponse
        });

        await chat.save();

        res.json({
            response: aiResponse,
            history: chat.messages
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get chat history
// @route   GET /api/chat
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const chat = await Chat.findOne({ userId: req.user._id });
        res.json(chat ? chat.messages : []);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
