# D.A.I.V.E. API Settings Guide

## Overview

The D.A.I.V.E. system now includes comprehensive API key management and voice conversation integration settings. This guide explains how to configure and use these features.

## Features Added

### 1. API Key Management
- **OpenAI API Key**: Required for AI conversation processing
- **ElevenLabs API Key**: For voice synthesis (recommended)
- **Azure Speech API Key**: Alternative voice synthesis option
- **Secure Storage**: All API keys are encrypted and stored securely
- **Test Connections**: Built-in testing for each API service

### 2. Voice Integration Settings
- **Voice Provider Selection**: Choose between ElevenLabs, Azure, or Google Cloud
- **Language Support**: Multiple language options for voice responses
- **Voice Customization**: Adjust speed and pitch settings
- **Real-time Testing**: Test voice synthesis with your configured settings

### 3. Integration Settings
- **Webhook Integration**: Send conversation data to external systems
- **CRM Integration**: Connect with your CRM system
- **Analytics Export**: Export conversation analytics

## Database Schema

### New Table: `daive_api_settings`

```sql
CREATE TABLE IF NOT EXISTS daive_api_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    setting_type TEXT NOT NULL, -- 'openai_key', 'elevenlabs_key', 'azure_speech_key', 'voice_provider'
    setting_value TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealer_id, setting_type)
);
```

## API Endpoints

### 1. Save API Setting
```http
POST /api/daive/api-settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "settingType": "openai_key",
  "settingValue": "sk-your-api-key-here"
}
```

### 2. Get API Settings
```http
GET /api/daive/api-settings
Authorization: Bearer <token>
```

### 3. Delete API Setting
```http
DELETE /api/daive/api-settings/:settingType
Authorization: Bearer <token>
```

### 4. Test API Connection
```http
POST /api/daive/test-api
Authorization: Bearer <token>
Content-Type: application/json

{
  "apiType": "openai"
}
```

## Frontend Features

### API Keys Tab
- **Secure Display**: API keys are masked by default
- **Show/Hide Toggle**: Click to reveal or hide API keys
- **Test Connections**: Test each API service individually
- **Delete Keys**: Remove API keys with confirmation
- **Direct Links**: Quick links to get API keys from providers

### Voice Settings Tab
- **Provider Selection**: Choose your preferred voice provider
- **Language Options**: Select from multiple languages
- **Voice Customization**: Adjust speed and pitch
- **Real-time Preview**: Test voice settings before saving

### Integration Tab
- **Webhook Configuration**: Set up external data feeds
- **CRM Integration**: Connect with popular CRM systems
- **Analytics Export**: Download conversation analytics

## Getting API Keys

### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Paste into the OpenAI API Key field

### ElevenLabs API Key
1. Visit [ElevenLabs](https://elevenlabs.io/)
2. Sign up or log in
3. Go to your profile settings
4. Copy your API key
5. Paste into the ElevenLabs API Key field

### Azure Speech API Key
1. Visit [Azure Speech Services](https://azure.microsoft.com/en-us/services/cognitive-services/speech-services/)
2. Create a Speech resource in Azure
3. Go to "Keys and Endpoint"
4. Copy Key 1 or Key 2
5. Paste into the Azure Speech API Key field

## Security Features

### API Key Protection
- **Encryption**: All API keys are encrypted at rest
- **Masked Display**: Keys are hidden by default in the UI
- **Secure Transmission**: Keys are transmitted over HTTPS only
- **Access Control**: Only authenticated dealers can access their keys

### Best Practices
1. **Never share API keys** publicly
2. **Rotate keys regularly** for security
3. **Use environment variables** in production
4. **Monitor API usage** to control costs
5. **Test connections** before enabling features

## Voice Integration

### Supported Providers

#### ElevenLabs (Recommended)
- **Pros**: High-quality voices, easy integration, good pricing
- **Cons**: Limited free tier
- **Best for**: Most use cases

#### Azure Speech Services
- **Pros**: Enterprise-grade, extensive language support
- **Cons**: More complex setup, higher cost
- **Best for**: Enterprise deployments

#### Google Cloud Speech
- **Pros**: Excellent accuracy, good integration
- **Cons**: Requires Google Cloud account
- **Best for**: Google ecosystem users

### Voice Configuration
- **Language**: Select from supported languages
- **Speed**: Adjust from 0.5x to 2.0x
- **Pitch**: Modify from 0.5x to 2.0x
- **Provider**: Choose your preferred service

## Testing Your Setup

### 1. Test API Connections
1. Go to the API Keys tab
2. Enter your API keys
3. Click "Test" for each service
4. Verify successful connections

### 2. Test Voice Synthesis
1. Configure voice settings
2. Enable voice responses
3. Start a conversation with D.A.I.V.E.
4. Verify voice output works correctly

### 3. Test Integration
1. Set up webhook endpoints
2. Configure CRM integration
3. Test data flow to external systems

## Troubleshooting

### Common Issues

#### API Key Not Working
- Verify the key is correct and complete
- Check if the service is active
- Ensure you have sufficient credits/quota
- Test the connection using the built-in tester

#### Voice Not Working
- Confirm API keys are configured
- Check voice provider selection
- Verify language settings
- Test individual API connections

#### Integration Failures
- Check webhook URLs are correct
- Verify authentication credentials
- Test external system connectivity
- Review error logs for details

### Error Messages

#### "API connection failed"
- Check API key validity
- Verify service is active
- Ensure sufficient quota/credits

#### "Voice synthesis error"
- Confirm voice provider is configured
- Check language support
- Verify API key permissions

#### "Integration timeout"
- Check network connectivity
- Verify external system status
- Review webhook configuration

## Cost Optimization

### OpenAI Usage
- Use appropriate models for your needs
- Monitor token usage
- Set usage limits
- Consider caching responses

### Voice Services
- ElevenLabs: Pay per character
- Azure: Pay per hour of audio
- Google: Pay per request

### Best Practices
1. **Monitor usage** regularly
2. **Set up alerts** for high usage
3. **Cache responses** when possible
4. **Use appropriate models** for your use case
5. **Optimize prompts** to reduce token usage

## Support

For additional support:
- Check the troubleshooting section above
- Review API provider documentation
- Contact support with specific error messages
- Include logs and configuration details

## Future Enhancements

### Planned Features
- **More Voice Providers**: Additional TTS services
- **Advanced Analytics**: Detailed usage reports
- **Custom Voices**: Train custom voice models
- **Multi-language Support**: Automatic language detection
- **Voice Cloning**: Create custom dealer voices

### Integration Roadmap
- **Salesforce Integration**: Direct CRM connection
- **HubSpot Integration**: Marketing automation
- **Zapier Integration**: Workflow automation
- **Custom Webhooks**: Advanced data routing
- **Analytics Dashboard**: Real-time insights

---

*This guide covers the complete API settings and voice integration features for D.A.I.V.E. For additional questions or support, please contact the development team.* 