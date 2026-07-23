# Voice Recognition Troubleshooting Guide

## Issue: "Voice recognition is not configured"

### ✅ **Step 1: Check DAIVE Settings**

1. **Log in as dealer1@example.com**
2. **Go to DAIVE Settings → Voice Settings**
3. **Enable "Voice Responses"** (toggle should be ON)
4. **Save Voice Settings**

### ✅ **Step 2: Verify API Keys**

1. **Go to DAIVE Settings → API Keys**
2. **Check OpenAI API Key** is configured
3. **Check ElevenLabs API Key** is configured
4. **Test API connections** using the Test buttons

### ✅ **Step 3: Use a Real Vehicle**

The voice recognition needs a vehicle with a `dealer_id` field:

1. **Go to Vehicles page**
2. **Select a vehicle** that belongs to dealer1@example.com
3. **Open the vehicle detail page**
4. **Start D.A.I.V.E. chat**

### ✅ **Step 4: Check Browser Permissions**

1. **Allow microphone access** when prompted
2. **Check browser settings** for microphone permissions
3. **Try in a different browser** if issues persist

### ✅ **Step 5: Test Voice Input**

1. **Click the microphone button** (🎤) in chat
2. **Speak clearly** and slowly
3. **Click microphone again** to stop recording
4. **Wait for transcription** and response

## 🔧 **Technical Debugging**

### Check Console Logs

1. **Open browser developer tools** (F12)
2. **Go to Console tab**
3. **Look for error messages** when using voice
4. **Check Network tab** for failed requests

### Common Issues

#### Issue: "Voice recognition is not configured"
**Solution**: 
- Make sure OpenAI API key is configured in DAIVE Settings
- Check that voice is enabled in Voice Settings
- Use a vehicle that belongs to the configured dealer

#### Issue: Microphone not working
**Solution**:
- Allow microphone permissions in browser
- Check if microphone is being used by other apps
- Try refreshing the page

#### Issue: No voice response
**Solution**:
- Check ElevenLabs API key is configured
- Enable voice responses in Voice Settings
- Check browser audio settings

#### Issue: Poor transcription quality
**Solution**:
- Speak clearly and slowly
- Reduce background noise
- Use a good quality microphone
- Check OpenAI API key is valid

## 🎯 **Quick Test Steps**

1. **Log in as dealer1@example.com**
2. **Go to DAIVE Settings → Voice Settings**
3. **Enable "Voice Responses"**
4. **Save settings**
5. **Go to a vehicle detail page**
6. **Click "Chat with D.A.I.V.E."**
7. **Click microphone button**
8. **Say "Hello, can you tell me about this vehicle?"**
9. **Listen for voice response**

## 📞 **If Still Not Working**

1. **Check server logs** for error messages
2. **Verify API keys** are valid and working
3. **Test API connections** in DAIVE Settings
4. **Try a different browser** or device
5. **Contact support** with specific error messages

## 🎤 **Voice Features Checklist**

- ✅ Voice toggle enabled in chat
- ✅ Microphone button visible
- ✅ Recording indicator shows
- ✅ Transcription appears in chat
- ✅ Voice response plays automatically
- ✅ Audio replay buttons work

## 🔍 **Debug Information**

When reporting issues, include:
- Browser type and version
- Error messages from console
- Steps to reproduce the issue
- Whether microphone permissions are granted
- API key configuration status 