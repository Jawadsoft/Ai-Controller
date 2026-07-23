#!/usr/bin/env node

import WebSocket from 'ws';

// Test configuration
const config = {
    port: process.env.PORT || 3000,
    dealerId: process.env.DEALER_ID || 'test123',
    vehicleId: process.env.VEHICLE_ID || '',
    testType: process.argv[2] || 'primary' // 'primary' or 'fallback'
};

console.log('🔌 WebSocket Connection Test (Node.js)');
console.log('=====================================');
console.log(`Port: ${config.port}`);
console.log(`Dealer ID: ${config.dealerId}`);
console.log(`Vehicle ID: ${config.vehicleId || 'none'}`);
console.log(`Test Type: ${config.testType}`);
console.log('');

// Build WebSocket URL
let wsUrl;
if (config.testType === 'primary') {
    wsUrl = `ws://localhost:${config.port}/streaming-voice?dealerId=${config.dealerId}${config.vehicleId ? `&vehicleId=${config.vehicleId}` : ''}`;
    console.log(`🔌 Testing PRIMARY connection to: ${wsUrl}`);
} else {
    wsUrl = `ws://localhost:${config.port}?dealerId=${config.dealerId}${config.vehicleId ? `&vehicleId=${config.vehicleId}` : ''}`;
    console.log(`🔄 Testing FALLBACK connection to: ${wsUrl}`);
}

console.log('');

// Create WebSocket connection
const ws = new WebSocket(wsUrl);

// Connection event handlers
ws.on('open', function open() {
    console.log('✅ WebSocket connected successfully!');
    console.log(`📊 Ready State: ${ws.readyState} (OPEN)`);
    console.log(`🔗 URL: ${wsUrl}`);
    console.log('');
    
    // Send initialization message after a short delay
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log('📤 Sending initialization message...');
            const initMessage = {
                type: 'initialize',
                dealerId: config.dealerId,
                vehicleId: config.vehicleId,
                performanceMode: true,
                timestamp: Date.now()
            };
            
            try {
                ws.send(JSON.stringify(initMessage));
                console.log('✅ Initialization message sent successfully');
                console.log(`📤 Message: ${JSON.stringify(initMessage, null, 2)}`);
            } catch (error) {
                console.error('❌ Error sending initialization message:', error.message);
            }
        } else {
            console.warn('⚠️ WebSocket not ready, skipping initialization message');
        }
    }, 100);
    
    // Send a ping message after 2 seconds
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log('📤 Sending ping message...');
            const pingMessage = {
                type: 'ping',
                timestamp: Date.now()
            };
            
            try {
                ws.send(JSON.stringify(pingMessage));
                console.log('✅ Ping message sent successfully');
            } catch (error) {
                console.error('❌ Error sending ping message:', error.message);
            }
        }
    }, 2000);
    
    // Send a test text message after 4 seconds
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log('📤 Sending test text message...');
            const textMessage = {
                type: 'process_text',
                text: 'Hello from Node.js WebSocket test client!',
                timestamp: Date.now()
            };
            
            try {
                ws.send(JSON.stringify(textMessage));
                console.log('✅ Text message sent successfully');
            } catch (error) {
                console.error('❌ Error sending text message:', error.message);
            }
        }
    }, 4000);
    
    // Close connection after 6 seconds
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log('🔌 Closing connection after test completion...');
            ws.close(1000, 'Test completed successfully');
        }
    }, 6000);
});

ws.on('message', function message(data) {
    try {
        const parsed = JSON.parse(data);
        console.log('📥 Received message:');
        console.log(`   Type: ${parsed.type}`);
        console.log(`   Timestamp: ${parsed.timestamp || 'N/A'}`);
        console.log(`   Data: ${JSON.stringify(parsed, null, 2)}`);
        console.log('');
    } catch (error) {
        console.log('📥 Received raw message:', data.toString());
        console.log('');
    }
});

ws.on('close', function close(code, reason) {
    console.log('🔌 WebSocket connection closed');
    console.log(`   Code: ${code}`);
    console.log(`   Reason: ${reason || 'No reason provided'}`);
    console.log(`   Clean: ${code === 1000 ? 'Yes' : 'No'}`);
    
    if (code === 1000) {
        console.log('✅ Test completed successfully!');
        process.exit(0);
    } else {
        console.log('⚠️ Connection closed abnormally');
        process.exit(1);
    }
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err.message);
    console.error('   Error details:', err);
    process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, closing connection...');
    if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Process interrupted');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, closing connection...');
    if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Process terminated');
    }
    process.exit(0);
});

// Connection timeout
setTimeout(() => {
    if (ws.readyState === WebSocket.CONNECTING) {
        console.error('⏰ Connection timeout - WebSocket failed to connect within 10 seconds');
        ws.terminate();
        process.exit(1);
    }
}, 10000);

console.log('⏳ Attempting to connect...');
console.log('');
