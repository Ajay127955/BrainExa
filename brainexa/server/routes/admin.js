const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Chat = require('../models/Chat');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get system stats
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', protect, admin, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const chatCount = await Chat.countDocuments();

        // Calculate total messages (approximate)
        const chats = await Chat.find({});
        let messageCount = 0;
        chats.forEach(chat => {
            messageCount += chat.messages.length;
        });

        res.json({
            users: userCount,
            chats: chatCount,
            messages: messageCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
