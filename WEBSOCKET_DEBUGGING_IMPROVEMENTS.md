# 🔍 WebSocket Debugging Improvements

## 🚨 **Current Issue**
The `OptimizedAIBotPage` is still experiencing WebSocket connection failures with:
- `readyState: 0` (CONNECTING state)
- Immediate error after connection attempt
- URL format appears correct: `ws://localhost:3000/streaming-voice?dealerId=...`

## ✅ **Debugging Improvements Added**

### **1. Enhanced Error Logging**
```typescript
websocketRef.current.onerror = (error) => {
  console.error('WebSocket error:', error);
  console.error('WebSocket readyState:', websocketRef.current?.readyState);
  console.error('WebSocket URL attempted:', wsUrl);
  
  // Log more detailed error information
  if (error.target && 'url' in error.target) {
    const wsTarget = error.target as WebSocket;
    console.error('Error target URL:', wsTarget.url);
    console.error('Error target readyState:', wsTarget.readyState);
    console.error('Error target protocol:', wsTarget.protocol);
  }
  
  // Log error type and details
  console.error('Error type:', error.type);
  console.error('Error isTrusted:', error.isTrusted);
  console.error('Error eventPhase:', error.eventPhase);
};
```

### **2. Connection Timeout Protection**
```typescript
// Add connection timeout
const connectionTimeout = setTimeout(() => {
  if (websocketRef.current?.readyState === WebSocket.CONNECTING) {
    console.error('WebSocket connection timeout after 10 seconds');
    websocketRef.current.close();
    setConnectionStatus('disconnected');
    toast({
      title: "Connection Timeout",
      description: "WebSocket connection timed out. Please check server status.",
      variant: "destructive"
    });
  }
}, 10000); // 10 second timeout
```

### **3. Improved Connection Timing**
```typescript
websocketRef.current.onopen = () => {
  clearTimeout(connectionTimeout); // Clear the connection timeout
  console.log('🚀 WebSocket onopen event fired');
  console.log('🚀 WebSocket readyState:', websocketRef.current?.readyState);
  
  // Wait a moment to ensure WebSocket is fully ready
  setTimeout(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      setConnectionStatus('connected');
      // Send initialization message...
    } else {
      console.warn('WebSocket not ready after delay, readyState:', websocketRef.current?.readyState);
      setConnectionStatus('disconnected');
    }
  }, 100); // Small delay to ensure WebSocket is fully ready
};
```

### **4. Proper Timeout Cleanup**
- Timeout cleared on successful connection (`onopen`)
- Timeout cleared on connection failure (`onclose`)
- Prevents hanging connections

## 🧪 **Testing Steps**

### **Step 1: Test with Enhanced Logging**
1. Navigate to `OptimizedAIBotPage`
2. Check browser console for detailed error logs
3. Look for the new error details:
   - Error target URL, readyState, protocol
   - Error type, isTrusted, eventPhase

### **Step 2: Monitor Connection Timing**
1. Watch for connection timeout messages
2. Check if the 100ms delay helps with message sending
3. Monitor readyState transitions

### **Step 3: Compare with Simple Test**
1. Open `simple-websocket-test.html` in browser
2. Use the same dealerId: `0aa94346-ed1d-420e-8823-bcd97bf6456f`
3. Compare error messages and behavior

## 🔍 **Expected Debug Information**

With the enhanced logging, you should now see:

```
❌ WebSocket error: Event {isTrusted: true, type: 'error', ...}
❌ WebSocket readyState: 0
❌ WebSocket URL attempted: ws://localhost:3000/streaming-voice?dealerId=...
❌ Error target URL: ws://localhost:3000/streaming-voice?dealerId=...
❌ Error target readyState: 0
❌ Error target protocol: 
❌ Error type: error
❌ Error isTrusted: true
❌ Error eventPhase: 2
```

## 🎯 **Potential Root Causes**

### **1. Browser WebSocket Limitation**
- Some browsers have limits on concurrent WebSocket connections
- Check if other WebSocket connections are active

### **2. DealerId Format Issue**
- The specific UUID format might be causing parsing issues
- Test with a simpler dealerId like "test123"

### **3. Server-Side Parsing**
- The server might be having issues parsing the specific dealerId
- Check server logs for any errors

### **4. Network/Firewall Issues**
- Local firewall blocking WebSocket upgrade
- Antivirus software interfering

## 📋 **Next Debugging Steps**

1. **Check server logs** for any WebSocket connection errors
2. **Test with simple dealerId** (e.g., "test123" instead of UUID)
3. **Compare browser behavior** between different browsers
4. **Check for other active WebSocket connections** that might be conflicting

The enhanced logging should now provide much more detailed information about what's causing the connection to fail immediately after the `onopen` event.
