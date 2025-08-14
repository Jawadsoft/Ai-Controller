# 🚀 CrewAI Debug Interface - Complete Testing Guide

This guide explains how to use the comprehensive debugging tools for testing your CrewAI system's performance, API endpoints, and voice settings.

## 📁 Available Debugging Tools

### 1. **HTML Debug Interface** (`crewai-debug.html`)
A comprehensive web-based debugging dashboard for real-time testing and monitoring.

### 2. **API Testing Script** (`test-api-endpoints.js`)
A Node.js command-line script for testing all CrewAI API endpoints.

## 🎯 HTML Debug Interface Features

### **📊 Performance Metrics Dashboard**
- Real-time tracking of average response times
- Intent detection performance
- Lead scoring performance  
- TTS generation performance
- Total tests run counter

### **🎤 Voice & TTS Testing**
- Test TTS generation with different providers (ElevenLabs, OpenAI)
- Configure dealer-specific settings
- Measure TTS response times
- Test voice settings retrieval

### **🔌 API Endpoint Testing**
- Test individual API endpoints
- Batch test all endpoints
- Custom request payloads
- Response time measurement
- Error handling and logging

### **⚡ Performance Testing Suite**
- Run iterative performance tests
- Test intent detection accuracy
- Test lead scoring algorithms
- Performance benchmarking
- Statistical analysis

### **🏥 System Health Monitoring**
- Backend server status
- Database connection health
- OpenAI API availability
- ElevenLabs API status
- Real-time health checks

### **📝 Live Debug Console**
- Real-time logging
- Performance metrics
- Error tracking
- System events

## 🚀 How to Use the HTML Debug Interface

### **Step 1: Open the Interface**
1. Make sure your backend server is running on port 3000
2. Open `crewai-debug.html` in your web browser
3. The interface will automatically check system health

### **Step 2: Test Voice & TTS**
1. **TTS Testing**: Enter text and select TTS provider
2. **Voice Settings**: Test configuration retrieval
3. **Performance**: Monitor response times in real-time

### **Step 3: Test API Endpoints**
1. Select endpoint from dropdown
2. Configure request payload (JSON)
3. Run individual or batch tests
4. Monitor response times and results

### **Step 4: Run Performance Tests**
1. Set test message and iterations
2. Run comprehensive performance suite
3. Monitor metrics dashboard updates
4. Analyze performance trends

### **Step 5: Monitor System Health**
1. Check all service statuses
2. Monitor API availability
3. Track database connectivity
4. View real-time health metrics

## 🔧 Command-Line API Testing

### **Prerequisites**
```bash
# Install node-fetch if not already available
npm install node-fetch
```

### **Run All Tests**
```bash
node test-api-endpoints.js
```

### **Test Individual Endpoints**
```javascript
import { testHealthCheck, testCrewAIChat } from './test-api-endpoints.js';

// Test specific endpoints
await testHealthCheck();
await testCrewAIChat();
```

## 📊 Performance Metrics Explained

### **Intent Detection**
- **Target**: < 1ms
- **Measurement**: Time to classify user message intent
- **Optimization**: Rule-based classification for speed

### **Lead Scoring**
- **Target**: < 1ms  
- **Measurement**: Time to calculate lead qualification score
- **Optimization**: Cached scoring algorithms

### **TTS Generation**
- **Target**: < 4 seconds
- **Measurement**: Time to generate audio from text
- **Optimization**: Model selection, caching, file operations

### **API Response**
- **Target**: < 8 seconds
- **Measurement**: End-to-end API response time
- **Optimization**: Database queries, LLM calls, caching

## 🎯 Testing Scenarios

### **1. Basic Functionality Testing**
- Health check endpoints
- Settings retrieval
- Basic chat processing

### **2. Performance Benchmarking**
- Response time measurement
- Throughput testing
- Load testing scenarios

### **3. Error Handling Testing**
- Invalid inputs
- Network failures
- Service unavailability

### **4. Integration Testing**
- End-to-end workflows
- Cross-service communication
- Data consistency

## 🔍 Debugging Common Issues

### **High TTS Response Times**
1. Check TTS provider settings
2. Verify API key validity
3. Monitor file system performance
4. Check network latency

### **Slow Intent Detection**
1. Verify rule-based logic
2. Check for infinite loops
3. Monitor memory usage
4. Review classification algorithms

### **API Timeouts**
1. Check database connectivity
2. Verify OpenAI API status
3. Monitor server resources
4. Check network configuration

### **Voice Settings Issues**
1. Verify database schema
2. Check dealer ID format
3. Validate API key configuration
4. Test fallback mechanisms

## 📈 Performance Optimization Tips

### **TTS Optimization**
- Use faster models (tts-1 vs tts-1-hd)
- Implement settings caching
- Optimize file operations
- Use async processing

### **API Optimization**
- Implement response caching
- Optimize database queries
- Use connection pooling
- Implement rate limiting

### **Intent Detection Optimization**
- Cache classification results
- Use efficient regex patterns
- Implement early returns
- Optimize rule evaluation

## 🚨 Troubleshooting

### **Interface Not Loading**
1. Check backend server status
2. Verify port 3000 accessibility
3. Check browser console for errors
4. Verify file permissions

### **API Tests Failing**
1. Check server logs
2. Verify endpoint URLs
3. Check authentication requirements
4. Monitor network connectivity

### **Performance Tests Slow**
1. Check system resources
2. Monitor database performance
3. Verify API rate limits
4. Check for memory leaks

## 📋 Best Practices

### **Regular Testing**
- Run performance tests weekly
- Monitor system health daily
- Test all endpoints monthly
- Validate voice settings regularly

### **Performance Monitoring**
- Track response time trends
- Monitor error rates
- Watch resource usage
- Set performance alerts

### **Documentation**
- Record test results
- Document performance improvements
- Track configuration changes
- Maintain troubleshooting logs

## 🎉 Success Metrics

### **Excellent Performance**
- Intent Detection: < 1ms
- Lead Scoring: < 1ms
- TTS Generation: < 2s
- API Response: < 3s

### **Good Performance**
- Intent Detection: < 5ms
- Lead Scoring: < 5ms
- TTS Generation: < 4s
- API Response: < 8s

### **Needs Improvement**
- Intent Detection: > 10ms
- Lead Scoring: > 10ms
- TTS Generation: > 7s
- API Response: > 15s

## 🔗 Related Files

- `src/lib/daivecrewai.js` - Main CrewAI service
- `src/routes/daive.js` - API route definitions
- `src/pages/AIBotPage.tsx` - Frontend CrewAI interface
- `src/components/daive/DAIVESettings.tsx` - Voice settings component

## 📞 Support

For issues or questions:
1. Check the debug console for errors
2. Review system health status
3. Test individual components
4. Check backend server logs
5. Verify configuration settings

---

**Happy Debugging! 🚀✨**

Your CrewAI system is now fully equipped with comprehensive testing and debugging capabilities! 