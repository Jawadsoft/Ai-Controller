# Structured Responses for D.A.I.V.E. AI Bot

## Overview
This system provides structured, list-based responses for your AI bot that present users with clear options and choices. Instead of long text responses, users see organized lists with numbered options that they can easily select from.

## Features

### 🎯 **Structured Options**
- **Numbered lists** for easy reference
- **Clear titles** and descriptions for each option
- **Interactive elements** that respond to user clicks
- **Visual hierarchy** with icons and colors

### 🎨 **Multiple Variants**
- **Default**: Balanced layout with good readability
- **Compact**: Space-efficient for mobile or limited space
- **Detailed**: Rich information display with expanded details

### 🔧 **Easy Integration**
- **Pre-built templates** for common scenarios
- **Customizable** for your specific needs
- **TypeScript support** for type safety
- **Responsive design** that works on all devices

## Quick Start

### 1. Import the Component
```tsx
import { StructuredResponse, responseTemplates } from '@/components/ai/StructuredResponse';
```

### 2. Use Pre-built Templates
```tsx
<StructuredResponse
  template={responseTemplates.testDriveOptions}
  onOptionSelect={(optionNumber) => {
    console.log('User selected:', optionNumber);
    // Handle the selection
  }}
/>
```

### 3. Create Custom Templates
```tsx
const customTemplate = {
  title: "🚗 Custom Options",
  message: "Here are your choices:",
  type: 'custom',
  options: [
    {
      number: "1",
      title: "First Option",
      description: "What this option does",
      details: "Additional information"
    },
    // ... more options
  ],
  footer: "What would you like to choose?"
};
```

## Available Templates

### 🚗 **Test Drive Options**
- Choose vehicle
- Select time & date
- Required documents

### 🚙 **Vehicle Selection**
- SUV Category
- Sedan Category
- Truck Category

### 🔧 **Service Options**
- Oil Change Service
- Brake Service
- Tire Service

### 💰 **Financing Options**
- Traditional Auto Loan
- Lease Options
- Cash Purchase

## Usage Examples

### Basic Usage
```tsx
function ChatMessage({ message }) {
  if (message.type === 'structured_response') {
    return (
      <StructuredResponse
        template={message.template}
        onOptionSelect={handleOptionSelect}
      />
    );
  }
  
  return <div>{message.content}</div>;
}
```

### With Variants
```tsx
// Compact for mobile
<StructuredResponse
  template={responseTemplates.testDriveOptions}
  variant="compact"
  onOptionSelect={handleSelection}
/>

// Detailed for desktop
<StructuredResponse
  template={responseTemplates.vehicleSelection}
  variant="detailed"
  onOptionSelect={handleSelection}
/>
```

### Custom Styling
```tsx
<StructuredResponse
  template={customTemplate}
  onOptionSelect={(option) => {
    // Custom logic
    if (option === "1") {
      showVehicleInventory();
    } else if (option === "2") {
      showTestDriveCalendar();
    }
  }}
/>
```

## Integration with AI Bot

### 1. **Message Handler**
```tsx
const handleAIResponse = (response) => {
  if (response.type === 'structured_options') {
    return (
      <StructuredResponse
        template={response.template}
        onOptionSelect={(option) => {
          // Send user selection back to AI
          sendMessage(`I choose option ${option}`);
        }}
      />
    );
  }
  
  return <div>{response.text}</div>;
};
```

### 2. **AI Response Generation**
```tsx
// In your AI logic
function generateStructuredResponse(userQuery) {
  if (userQuery.includes('test drive')) {
    return {
      type: 'structured_response',
      template: responseTemplates.testDriveOptions
    };
  }
  
  if (userQuery.includes('vehicle')) {
    return {
      type: 'structured_response',
      template: responseTemplates.vehicleSelection
    };
  }
  
  // Default text response
  return {
    type: 'text',
    content: 'I can help you with that...'
  };
}
```

### 3. **Conversation Flow**
```tsx
const [conversation, setConversation] = useState([]);

const addAIResponse = (response) => {
  const newMessage = {
    id: Date.now(),
    type: 'ai',
    content: response.type === 'structured_response' 
      ? <StructuredResponse template={response.template} onOptionSelect={handleOptionSelect} />
      : response.content,
    timestamp: new Date()
  };
  
  setConversation(prev => [...prev, newMessage]);
};
```

## Customization

### Colors and Icons
```tsx
// Add new types to getIconForType function
const getIconForType = (type) => {
  switch (type) {
    case 'custom':
      return <CustomIcon className="h-5 w-5" />;
    // ... existing cases
  }
};

// Add new colors to getColorForType function
const getColorForType = (type) => {
  switch (type) {
    case 'custom':
      return 'bg-custom-50 text-custom-700 border-custom-200';
    // ... existing cases
  }
};
```

### Styling
```tsx
// Override default styles with custom classes
<StructuredResponse
  template={template}
  className="custom-styles"
  cardClassName="custom-card"
  optionClassName="custom-option"
/>
```

## Best Practices

### 1. **Option Count**
- Keep options between **3-5** for best usability
- More than 5 options can overwhelm users
- Less than 3 might not need structured format

### 2. **Option Descriptions**
- Keep descriptions **concise** but informative
- Use **action-oriented** language
- Include **key details** users need to decide

### 3. **Footer Messages**
- Make them **actionable** and clear
- Ask **specific questions** to guide users
- Use **friendly, conversational** tone

### 4. **Response Flow**
- **Follow up** after user selection
- Provide **additional context** when needed
- **Guide users** through multi-step processes

## Example Response Flow

```
User: "I want to schedule a test drive"

AI: [Structured Response with 3 options]
1. Choose Your Vehicle
2. Select Time & Date  
3. Required Documents

User: [Clicks Option 1]

AI: "Great! Let me show you our available vehicles..."
[Shows vehicle selection structured response]

User: [Clicks SUV Category]

AI: "Perfect! Here are our SUV options..."
[Shows specific SUV models]
```

## Troubleshooting

### Common Issues

1. **Options not clickable**
   - Check `onOptionSelect` prop is passed
   - Verify template structure is correct

2. **Styling issues**
   - Ensure UI components are imported
   - Check Tailwind classes are available

3. **Type errors**
   - Verify TypeScript interfaces match
   - Check template structure matches interface

### Debug Mode
```tsx
<StructuredResponse
  template={template}
  onOptionSelect={(option) => {
    console.log('Option selected:', option);
    console.log('Template used:', template);
  }}
  debug={true} // Add debug logging
/>
```

## Future Enhancements

- [ ] **Animation support** for option transitions
- [ ] **Voice integration** for hands-free selection
- [ ] **Multi-language support** for international users
- [ ] **Analytics tracking** for option selection patterns
- [ ] **A/B testing** for different response formats
- [ ] **Machine learning** for optimal option ordering

## Support

For questions or issues with structured responses:
1. Check the example components
2. Review the TypeScript interfaces
3. Test with different template structures
4. Verify all dependencies are installed

---

**Happy coding! 🚗✨**
