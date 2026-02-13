const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI;
console.log('Testing MongoDB Connection...');
console.log('URI:', uri.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs

mongoose.connect(uri)
    .then(() => {
        console.log('✅ MongoDB Connection Successful!');
        console.log('Database:', mongoose.connection.name);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Failed:');
        console.error(err.message);
        console.log('\nPossible fixes:');
        console.log('1. Check if your IP is whitelisted in MongoDB Atlas.');
        console.log('2. Verify your username and password in .env');
        console.log('3. Ensure special characters in password are URL encoded (e.g. @ -> %40)');
        process.exit(1);
    });
