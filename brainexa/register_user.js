const http = require('http');

const data = JSON.stringify({
    name: 'TestUser',
    email: `test${Date.now()}@example.com`,
    password: 'password123'
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('BODY:', body);
        if (res.statusCode === 201) {
            console.log('Registration Successful');
            process.exit(0);
        } else {
            console.log('Registration Failed');
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
    process.exit(1);
});

req.write(data);
req.end();
