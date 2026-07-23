// This is a fixed version of daivecrewai.js with improved budget extraction
// and duplicate method removal

import { ClientJourneyTracker } from './clientJourneyTracker.js';

// import { sendNotification } from './websocket.js';

// =============================================================================
// CONTEXT-AWARE RESPONSE CONTROL
// =============================================================================
// Context-aware response generation is DISABLED by default.
// Instead, client preferences are passed directly to agents to prevent
// repetitive questions from being generated in the first place.
// 
// This approach ensures agents have all the information they need
// before generating responses, eliminating the need for post-processing
// modifications.

import OpenAI from 'openai';
import { CrewAI } from 'crewai';
import { Agent, Task, Process } from 'crewai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { InventoryService } from './inventoryService.js';
import { SettingsManager } from './settingsManager.js';
import { TTSManager } from './ttsManager.js';
import { OptimizedCrewAgentAI, MLIntentDetector, CrewAIMLIntegration } from './optimizedCrewAgentAI.js';
