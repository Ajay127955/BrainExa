const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        enum: ['user', 'assistant', 'system']
    },
    content: {
        type: String, // Text content or simple string
        required: true
    },
    image: {
        type: String // Base64 or URL
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const conversationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'New Chat'
    },
    messages: [messageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
// Update timestamp on save
conversationSchema.pre('save', async function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Conversation', conversationSchema);
