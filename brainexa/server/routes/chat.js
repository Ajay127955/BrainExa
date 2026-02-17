const express = require('express');
const router = express.Router();
const axios = require('axios');
const Conversation = require('../models/Conversation');
const { protect } = require('../middleware/authMiddleware');

// Helper: Generate Title (Simple version, can be improved with AI)
const generateTitle = (message) => {
    return message.slice(0, 30) + (message.length > 30 ? '...' : '');
};

// @desc    Send message to AI (Create new or append to existing)
// @route   POST /api/chat
// @access  Private
router.post('/', protect, async (req, res) => {
    const { message, image, conversationId } = req.body;

    if (!message && !image) {
        return res.status(400).json({ message: 'Message or Image is required' });
    }

    try {
        let conversation;
        let isNewConversation = false;

        // 1. Find or Create Conversation
        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, userId: req.user._id });
            if (!conversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
        } else {
            // Create new
            conversation = await Conversation.create({
                userId: req.user._id,
                title: generateTitle(message || 'New Image Chat'),
                messages: []
            });
            isNewConversation = true;
        }

        // 2. Add User Message
        const userMsg = {
            role: 'user',
            content: message || 'Image uploaded',
            image: image || null,
            timestamp: new Date()
        };
        conversation.messages.push(userMsg);

        // 3. Call LLM API
        const nvidiaKey = process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_KIMI_API_KEY;
        const groqApiKey = process.env.GROQ_API_KEY;

        let aiResponse = "I'm sorry, I couldn't process that.";
        let apiProvider = '';

        try {
            // Image Generation Check (Pollinations.ai)
            const imagePromptRegex = /(?:generate|create|draw|make) (?:an? )?(?:image|picture|photo) (?:of )?(.+)/i;
            const imageMatch = message && message.match(imagePromptRegex);

            if (imageMatch && !image) {
                const prompt = imageMatch[1];
                const encodedPrompt = encodeURIComponent(prompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
                aiResponse = `Here is the image of **${prompt}** you requested:\n\n![${prompt}](${imageUrl})`;
                apiProvider = 'Pollinations.ai';
            } else {
                // Prepare messages for API (include history context if needed, but for now sending last few + system)
                // NOTE: Sending full history might be too heavy. Let's send last 6 messages.
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

                // System Prompt
                recentMessages.unshift({
                    role: 'system',
                    content: `You are Brainexa, a highly advanced AI assistant. Be helpful, accurate, and concise.`
                });

                // ... (API Calls similar to before, kept concise here for readability) ...
                // Reuse existing logic for NVIDIA/Groq
                if (image && nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
                    apiProvider = 'NVIDIA Vision';
                    const response = await axios.post(
                        'https://integrate.api.nvidia.com/v1/chat/completions',
                        { model: 'nvidia/neva-22b', messages: recentMessages, temperature: 0.2, max_tokens: 1024 },
                        { headers: { 'Authorization': `Bearer ${nvidiaKey}`, 'Content-Type': 'application/json' } }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else if (image && groqApiKey) {
                    apiProvider = 'Groq Vision';
                    const response = await axios.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        { model: 'llama-3.2-11b-vision-preview', messages: recentMessages, temperature: 0.2, max_tokens: 1024 },
                        { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else if (nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
                    apiProvider = 'NVIDIA Llama 3.1';
                    // Sanitize
                    const textOnlyMessages = recentMessages.map(msg => {
                        if (Array.isArray(msg.content)) {
                            const textPart = msg.content.find(c => c.type === 'text');
                            return { ...msg, content: textPart ? textPart.text : '(Image)' };
                        }
                        return msg;
                    });
                    const response = await axios.post(
                        'https://integrate.api.nvidia.com/v1/chat/completions',
                        { model: 'meta/llama-3.1-70b-instruct', messages: textOnlyMessages, temperature: 0.5, max_tokens: 1024 },
                        { headers: { 'Authorization': `Bearer ${nvidiaKey}`, 'Content-Type': 'application/json' } }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else if (groqApiKey) {
                    apiProvider = 'Groq';
                    const response = await axios.post(
                        'https://api.groq.com/openai/v1/chat/completions',
                        { model: 'llama3-8b-8192', messages: recentMessages, temperature: 0.5 },
                        { headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' } }
                    );
                    aiResponse = response.data.choices[0].message.content;
                } else {
                    aiResponse = "No valid API Configuration found.";
                }
            }

        } catch (apiError) {
            console.error('API Error:', apiError.message);
            aiResponse = `Error: ${apiError.message}`;
        }

        // 4. Save AI Response
        conversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date()
        });

        // Update Title if it's the very first message and it was just "New Chat"
        if (isNewConversation && conversation.messages.length <= 2) {
            // In a real app, we'd ask the AI to generate a title.
            // For now, keep the simple one generated above.
        }

        await conversation.save();

        res.json({
            conversationId: conversation._id,
            title: conversation.title,
            response: aiResponse,
            history: conversation.messages
        });

    } catch (error) {
        console.error('Chat Route Error:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
});

// @desc    Get all conversations (for sidebar)
// @route   GET /api/chat/list
// @access  Private
router.get('/list', protect, async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.user._id })
            .select('title createdAt updatedAt')
            .sort({ updatedAt: -1 });
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get specific conversation history
// @route   GET /api/chat/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete specific conversation
// @route   DELETE /api/chat/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete ALL conversations
// @route   DELETE /api/chat
// @access  Private
router.delete('/', protect, async (req, res) => {
    try {
        await Conversation.deleteMany({ userId: req.user._id });
        res.json({ message: 'All history deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
