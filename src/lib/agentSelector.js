// Agent Selector for DAIVE
// Uses OpenAI to intelligently choose which agent should respond

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

class AgentSelector {
  constructor(openaiApiKey) {
    this.llm = new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1, // Low temperature for consistent agent selection
      maxTokens: 150
    });
    
    this.agents = {
      'sales_consultant': {
        name: 'Sales Consultant',
        role: 'Engage customers, explain vehicle features, and close deals',
        expertise: ['initial engagement', 'vehicle recommendations', 'customer needs assessment', 'greeting', 'general inquiries'],
        keywords: ['hello', 'hi', 'looking for', 'interested in', 'help', 'recommend', 'suggest', 'what do you have']
      },
      'product_specialist': {
        name: 'Product Specialist',
        role: 'Provide deep knowledge of vehicles, conduct demos, and assist test drives',
        expertise: ['vehicle specifications', 'features', 'safety', 'performance', 'test drives', 'vehicle types', 'comparisons'],
        keywords: ['suv', 'sedan', 'truck', 'hybrid', 'electric', 'features', 'specs', 'test drive', 'demo', 'what type']
      },
      'finance_manager': {
        name: 'Finance Manager',
        role: 'Offer financing options, leasing, and insurance add-ons',
        expertise: ['financing', 'loans', 'leasing', 'insurance', 'payments', 'budget', 'cost', 'pricing', 'monthly payments'],
        keywords: ['finance', 'loan', 'payment', 'budget', 'cost', 'price', 'monthly', 'apr', 'interest', 'afford']
      },
      'service_advisor': {
        name: 'Service Advisor',
        role: 'Ensure post-sale support, schedule services, and maintain customer loyalty',
        expertise: ['maintenance', 'service', 'warranty', 'repairs', 'scheduling', 'post-sale support'],
        keywords: ['service', 'maintenance', 'warranty', 'repair', 'schedule', 'appointment', 'oil change', 'tune up']
      }
    };
  }

  // Select the best agent for a user message
  async selectAgent(userMessage, conversationContext = {}) {
    try {
      console.log('🤖 Agent Selection - Analyzing user message:', userMessage.substring(0, 100));
      
      // Create the selection prompt
      const selectionPrompt = this.createSelectionPrompt(userMessage, conversationContext);
      
      // Get agent selection from OpenAI
      const response = await this.llm.invoke(selectionPrompt);
      const selectedAgent = this.parseAgentResponse(response.content);
      
      console.log('✅ Agent selected:', selectedAgent);
      
      return {
        agent: selectedAgent,
        confidence: this.calculateConfidence(userMessage, selectedAgent),
        reasoning: response.content
      };
      
    } catch (error) {
      console.error('❌ Error in agent selection:', error);
      // Fallback to rule-based selection
      return this.fallbackAgentSelection(userMessage, conversationContext);
    }
  }

  // Create the agent selection prompt
  createSelectionPrompt(userMessage, conversationContext) {
    const contextInfo = conversationContext.step ? `Current step: ${conversationContext.step}` : 'New conversation';
    const userPreferences = conversationContext.vehicleType ? `Vehicle type: ${conversationContext.vehicleType}` : 'No vehicle type specified';
    
    return [
      new HumanMessage({
        content: `You are an intelligent agent selector for a car dealership AI system. 

Available agents:
1. sales_consultant - For initial engagement, greetings, general help, and customer needs assessment
2. product_specialist - For vehicle specifications, types (SUV/sedan/truck), features, and test drives
3. finance_manager - For financing, loans, payments, budget, and pricing questions
4. service_advisor - For maintenance, service, warranty, and post-sale support

Conversation context:
- ${contextInfo}
- ${userPreferences}
- User message: "${userMessage}"

Task: Select the SINGLE most appropriate agent to handle this user message.

Rules:
- Choose only ONE agent
- Respond with ONLY the agent key (e.g., "sales_consultant")
- Consider the conversation flow and user's current needs
- If unsure, default to sales_consultant for general inquiries

Response (agent key only):`
      })
    ];
  }

  // Parse the agent response from OpenAI
  parseAgentResponse(response) {
    const cleanResponse = response.toLowerCase().trim();
    
    // Extract agent key from response
    if (cleanResponse.includes('sales_consultant') || cleanResponse.includes('sales consultant')) {
      return 'sales_consultant';
    } else if (cleanResponse.includes('product_specialist') || cleanResponse.includes('product specialist')) {
      return 'product_specialist';
    } else if (cleanResponse.includes('finance_manager') || cleanResponse.includes('finance manager')) {
      return 'finance_manager';
    } else if (cleanResponse.includes('service_advisor') || cleanResponse.includes('service advisor')) {
      return 'service_advisor';
    }
    
    // Default fallback
    return 'sales_consultant';
  }

  // Calculate confidence score for agent selection
  calculateConfidence(userMessage, selectedAgent) {
    const message = userMessage.toLowerCase();
    const agent = this.agents[selectedAgent];
    
    let score = 0;
    
    // Check keyword matches
    agent.keywords.forEach(keyword => {
      if (message.includes(keyword)) {
        score += 1;
      }
    });
    
    // Normalize score to 0-1 range
    return Math.min(score / agent.keywords.length, 1);
  }

  // Fallback agent selection using rule-based logic
  fallbackAgentSelection(userMessage, conversationContext) {
    const message = userMessage.toLowerCase();
    
    // Check for specific keywords
    if (/\b(suv|sedan|truck|hybrid|electric|features|specs|test drive|demo)\b/.test(message)) {
      return {
        agent: 'product_specialist',
        confidence: 0.8,
        reasoning: 'Vehicle type or feature inquiry detected'
      };
    }
    
    if (/\b(finance|loan|payment|budget|cost|price|monthly|apr)\b/.test(message)) {
      return {
        agent: 'finance_manager',
        confidence: 0.9,
        reasoning: 'Financial inquiry detected'
      };
    }
    
    if (/\b(service|maintenance|warranty|repair|schedule|appointment)\b/.test(message)) {
      return {
        agent: 'service_advisor',
        confidence: 0.9,
        reasoning: 'Service inquiry detected'
      };
    }
    
    // Default to sales consultant
    return {
      agent: 'sales_consultant',
      confidence: 0.6,
      reasoning: 'General inquiry, defaulting to sales consultant'
    };
  }

  // Get agent information
  getAgentInfo(agentKey) {
    return this.agents[agentKey] || null;
  }

  // Get all available agents
  getAllAgents() {
    return Object.keys(this.agents);
  }

  // Check if an agent is available
  isAgentAvailable(agentKey) {
    return this.agents.hasOwnProperty(agentKey);
  }
}

export default AgentSelector;
