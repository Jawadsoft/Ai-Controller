import React, { useState, useEffect, useRef } from 'react';

const MinimalWebSocketTest: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const websocketRef = useRef<WebSocket | null>(null);
  
  const log = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log(message);
  };
  
  const clearLogs = () => setLogs([]);
  
  const connect = () => {
    const dealerId = '0aa94346-ed1d-420e-8823-bcd97bf6456f';
    
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    setConnectionStatus('connecting');
    log('🔌 Attempting WebSocket connection...');
    
    const wsUrl = `ws://localhost:3000/streaming-voice?dealerId=${dealerId}`;
    log(`🔌 URL: ${wsUrl}`);
    
    try {
      websocketRef.current = new WebSocket(wsUrl);
      
      websocketRef.current.onopen = function(event) {
        log('✅ WebSocket connected successfully!');
        setConnectionStatus('connected');
        
        // Send a simple message
        try {
          websocketRef.current?.send(JSON.stringify({
            type: 'initialize',
            dealerId: dealerId
          }));
          log('📤 Sent initialization message');
        } catch (error) {
          log(`❌ Error sending message: ${error}`);
        }
      };
      
      websocketRef.current.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          log(`📥 Received: ${JSON.stringify(data)}`);
        } catch (error) {
          log(`📥 Received raw: ${event.data}`);
        }
      };
      
      websocketRef.current.onerror = function(error) {
        log(`❌ WebSocket error: ${JSON.stringify(error)}`);
        log(`❌ Error type: ${error.type}`);
        log(`❌ ReadyState: ${websocketRef.current?.readyState}`);
        
        // Log more error details
        if (error.target && 'url' in error.target) {
          const wsTarget = error.target as WebSocket;
          log(`❌ Target URL: ${wsTarget.url}`);
          log(`❌ Target readyState: ${wsTarget.readyState}`);
          log(`❌ Target protocol: ${wsTarget.protocol}`);
        }
      };
      
      websocketRef.current.onclose = function(event) {
        log(`🔌 WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'No reason'}`);
        log(`🔌 Clean close: ${event.wasClean}`);
        setConnectionStatus('disconnected');
        websocketRef.current = null;
      };
      
    } catch (error) {
      log(`❌ Error creating WebSocket: ${error}`);
      setConnectionStatus('disconnected');
    }
  };
  
  const disconnect = () => {
    if (websocketRef.current) {
      log('🔌 Manually disconnecting...');
      websocketRef.current.close(1000, 'Manual disconnect');
      websocketRef.current = null;
    }
  };
  
  // Auto-connect on mount
  useEffect(() => {
    log('🚀 Component mounted, ready to test WebSocket');
    connect();
    
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔌 Minimal React WebSocket Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={connect}
          style={{ padding: '10px 20px', margin: '5px', cursor: 'pointer' }}
        >
          Connect
        </button>
        <button 
          onClick={disconnect}
          style={{ padding: '10px 20px', margin: '5px', cursor: 'pointer' }}
        >
          Disconnect
        </button>
        <button 
          onClick={clearLogs}
          style={{ padding: '10px 20px', margin: '5px', cursor: 'pointer' }}
        >
          Clear Logs
        </button>
      </div>
      
      <div style={{
        padding: '10px',
        margin: '10px 0',
        borderRadius: '5px',
        fontWeight: 'bold',
        backgroundColor: connectionStatus === 'connected' ? '#d4edda' : 
                       connectionStatus === 'connecting' ? '#fff3cd' : '#f8d7da',
        color: connectionStatus === 'connected' ? '#155724' : 
               connectionStatus === 'connecting' ? '#856404' : '#721c24'
      }}>
        {connectionStatus === 'connected' ? '🚀 Connected' :
         connectionStatus === 'connecting' ? '⏳ Connecting...' : '❌ Disconnected'}
      </div>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '5px',
        margin: '15px 0',
        maxHeight: '400px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default MinimalWebSocketTest;
