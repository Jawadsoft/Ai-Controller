import { WebSocketServer } from 'ws';
import { createServer } from 'http';

let wss = null;
let httpServer = null;

export const initializeWebSocket = (expressApp) => {
  // Create HTTP server
  httpServer = createServer(expressApp);
  
  // Create WebSocket server
  wss = new WebSocketServer({ server: httpServer });
  
  // Store connected clients by user ID
  const clients = new Map();
  
  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    // Extract user ID from query parameters or headers
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    const userRole = url.searchParams.get('userRole');
    
    if (userId) {
      // Store client connection
      clients.set(userId, {
        ws,
        role: userRole,
        connectedAt: new Date()
      });
      
      console.log(`User ${userId} connected to WebSocket`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to notification service',
        timestamp: new Date().toISOString()
      }));
    }
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('Received message:', data);
        
        // Handle different message types
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;
          case 'notification_settings':
            // Store notification preferences
            if (userId) {
              const client = clients.get(userId);
              if (client) {
                client.notificationSettings = data.settings;
              }
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      if (userId) {
        clients.delete(userId);
        console.log(`User ${userId} disconnected from WebSocket`);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (userId) {
        clients.delete(userId);
      }
    });
  });
  
  // Function to send notification to specific user
  const sendNotification = (userId, notification) => {
    const client = clients.get(userId);
    if (client && client.ws.readyState === 1) { // 1 = OPEN
      try {
        client.ws.send(JSON.stringify({
          type: 'notification',
          ...notification,
          timestamp: new Date().toISOString()
        }));
        return true;
      } catch (error) {
        console.error('Error sending notification:', error);
        return false;
      }
    }
    return false;
  };
  
  // Function to send notification to all dealers
  const sendNotificationToDealers = (notification) => {
    let sentCount = 0;
    clients.forEach((client, userId) => {
      if (client.role === 'dealer' && client.ws.readyState === 1) {
        if (sendNotification(userId, notification)) {
          sentCount++;
        }
      }
    });
    return sentCount;
  };
  
  // Function to send notification to super admin
  const sendNotificationToSuperAdmin = (notification) => {
    let sentCount = 0;
    clients.forEach((client, userId) => {
      if (client.role === 'super_admin' && client.ws.readyState === 1) {
        if (sendNotification(userId, notification)) {
          sentCount++;
        }
      }
    });
    return sentCount;
  };
  
  return {
    httpServer,
    sendNotification,
    sendNotificationToDealers,
    sendNotificationToSuperAdmin,
    getConnectedClients: () => clients.size,
    getClientInfo: (userId) => clients.get(userId)
  };
};

export const getWebSocketServer = () => wss;
export const getHttpServer = () => httpServer; 