const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
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
        // Mock User ID (use a real one if possible, or create a dummy ObjectId)
        const userId = new mongoose.Types.ObjectId();

        console.log('1. Creating Conversation...');
        const conversation = await Conversation.create({
            userId: userId,
            title: 'Debug Chat',
            messages: []
        });
        console.log('Conversation Created:', conversation._id);

        console.log('2. Adding User Message...');
        conversation.messages.push({
            role: 'user',
            content: 'Hello Debug',
            timestamp: new Date()
        });

        console.log('3. Saving User Message...');
        await conversation.save();
        console.log('User Message Saved.');

        console.log('4. Adding Assistant Message...');
        const aiResponse = "This is a test response.";
        conversation.messages.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date()
        });

        console.log('5. Saving Assistant Message...');
        await conversation.save();
        console.log('Assistant Message Saved.');

        console.log('SUCCESS: Logic verified.');

    } catch (error) {
        console.error('CRASHED:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runDebug();
