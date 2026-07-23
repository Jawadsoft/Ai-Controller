import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import DAIVEService from './daivecrewai.js';
import settingsManager from './settingsManager.js';

let wss = null;
let httpServer = null;

export const initializeWebSocket = (expressApp) => {
  // Create HTTP server
  httpServer = createServer(expressApp);
  
  // Create single WebSocket server (no path restriction)
  wss = new WebSocketServer({ 
    server: httpServer
  });
  
  // Store connected clients by user ID
  const clients = new Map();
  
  // Handle all WebSocket connections with path-based routing
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    
         // Check if this is a streaming voice connection (either by path or by message type)
     const dealerId = url.searchParams.get('dealerId');
     const vehicleId = url.searchParams.get('vehicleId');
     const isStreamingVoice = path === '/streaming-voice' || dealerId;
     
     // Store these in the WebSocket object for use in message handlers
     ws.dealerId = dealerId;
     ws.vehicleId = vehicleId;
    
    if (isStreamingVoice) {
      // Handle streaming voice connections (both /streaming-voice and root with dealerId)
      console.log('New streaming voice WebSocket connection');
      console.log('Path:', path, 'DealerId:', dealerId);
      
      if (dealerId) {
        console.log(`Dealer ${dealerId} connected to streaming voice WebSocket`);
        
        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'connection',
          status: 'connected',
          dealerId,
          vehicleId
        }));
      }
      
      // Handle streaming voice messages
      ws.on('message', async (data) => {
        try {
          // Ensure Buffer payloads are parsed correctly
          const message = JSON.parse(typeof data === 'string' ? data : data.toString());
          console.log('Streaming voice message received:', message.type);
          
          // Handle different message types
          switch (message.type) {
            case 'initialize':
              // Handle initialization
              ws.send(JSON.stringify({
                type: 'initialized',
                status: 'ready'
              }));
              break;
            case 'audio_chunk':
              // Handle audio chunk
              ws.send(JSON.stringify({
                type: 'audio_received',
                timestamp: Date.now()
              }));
              break;
            case 'process_text':
              // Handle text processing with AI
              console.log('🤖 Processing text message:', message.text);
              
              // Send processing acknowledgment
              ws.send(JSON.stringify({
                type: 'processing',
                message: 'Text processing started'
              }));
              
              // Process with actual CrewAI service
              try {
                console.log('🚀 Initializing CrewAI service...');
                
                                 // Get dealer's API keys from settings manager
                 const dealerApiKeys = await settingsManager.getAPIKeys(ws.dealerId);
                 console.log('🔑 Dealer API keys retrieved:', dealerApiKeys ? 'Available' : 'Not available');
                 console.log('🔑 API Keys structure:', JSON.stringify(dealerApiKeys, null, 2));
                 
                                  // Check for OpenAI API key - the settings manager returns it as 'openai'
                 const openaiKey = dealerApiKeys?.openai;
                 
                 if (!dealerApiKeys || !openaiKey) {
                   console.log('⚠️ No OpenAI API key found for dealer, using fallback response');
                   console.log('🔍 Available keys:', Object.keys(dealerApiKeys || {}));
                   console.log('🔍 OpenAI key value:', openaiKey);
                   ws.send(JSON.stringify({
                     type: 'ai_response',
                     content: `I understand you're asking about pricing. Let me help you with that. ${message.text}`,
                     timestamp: Date.now()
                   }));
                   return;
                 }
                 
                 console.log('✅ OpenAI API key found:', openaiKey ? 'Available' : 'Not available');
                 
                                   // Create DAIVE service with proper settings
                  const daiveService = new DAIVEService();
                  
                  // Initialize the DAIVE service with the dealer ID (this sets up the settings manager and CrewAI)
                  await daiveService.initialize(ws.dealerId);
                
                if (daiveService.crewAI) {
                  console.log('✅ CrewAI initialized, processing with AI...');
                  
                                     // Process the message through CrewAI
                   const aiResponse = await daiveService.processWithCrewAI(message.text, {
                     dealerId: ws.dealerId,
                     vehicleId: ws.vehicleId,
                     context: 'websocket_chat'
                   });
                   
                   console.log('🤖 CrewAI response received:', aiResponse);
                   
                   // Extract the actual response content from the CrewAI response object
                   let responseContent;
                   if (typeof aiResponse === 'string') {
                     // Direct string response
                     responseContent = aiResponse;
                   } else if (aiResponse && typeof aiResponse === 'object') {
                     // Object response - extract the content
                     if (aiResponse.success && aiResponse.response) {
                       responseContent = aiResponse.response;
                     } else if (aiResponse.content) {
                       responseContent = aiResponse.content;
                     } else if (aiResponse.message) {
                       responseContent = aiResponse.message;
                     } else if (aiResponse.error) {
                       // If there's an error, use fallback
                       console.log('⚠️ CrewAI returned error, using fallback response');
                       responseContent = `I understand you're asking about pricing. Let me help you with that. ${message.text}`;
                     } else {
                       // Fallback if we can't extract content
                       console.log('⚠️ Could not extract content from CrewAI response, using fallback');
                       responseContent = `I understand you're asking about pricing. Let me help you with that. ${message.text}`;
                     }
                   } else {
                     // Fallback for unexpected response types
                     console.log('⚠️ Unexpected CrewAI response type, using fallback');
                     responseContent = `I understand you're asking about pricing. Let me help you with that. ${message.text}`;
                   }
                   
                   console.log('📝 Extracted response content:', responseContent);
                   
                   // Send the AI response
                   ws.send(JSON.stringify({
                     type: 'ai_response',
                     content: responseContent,
                     timestamp: Date.now()
                   }));
                } else {
                  console.log('⚠️ CrewAI not available, using fallback response');
                  // Fallback response if CrewAI fails
                  ws.send(JSON.stringify({
                    type: 'ai_response',
                    content: `I understand you're asking about pricing. Let me help you with that. ${message.text}`,
                    timestamp: Date.now()
                  }));
                }
              } catch (error) {
                console.error('Error processing text with CrewAI:', error);
                // Fallback response on error
                ws.send(JSON.stringify({
                  type: 'ai_response',
                  content: `I understand you're asking about pricing. Let me help you with that. ${message.text}`,
                  timestamp: Date.now()
                }));
              }
              break;
            case 'start_recording':
              // Handle start recording
              ws.send(JSON.stringify({
                type: 'recording_started',
                status: 'ready'
              }));
              break;
            case 'stop_recording':
              // Handle stop recording
              ws.send(JSON.stringify({
                type: 'recording_stopped',
                status: 'complete'
              }));
              break;
            default:
              console.log(`Unknown streaming voice message type: ${message.type}`);
          }
        } catch (error) {
          console.error('Error parsing streaming voice message:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('Streaming voice WebSocket disconnected');
      });
      
      ws.on('error', (error) => {
        console.error('Streaming voice WebSocket error:', error);
      });
      
    } else {
      // Handle general WebSocket connections (no dealerId, no streaming voice path)
      console.log('New general WebSocket connection');
      
      const userId = url.searchParams.get('userId');
      const userRole = url.searchParams.get('userRole');
      
      if (userId) {
        // Store client connection
        clients.set(userId, {
          ws,
          role: userRole,
          connectedAt: new Date()
        });
        
        console.log(`User ${userId} connected to general WebSocket`);
        
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
    }
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