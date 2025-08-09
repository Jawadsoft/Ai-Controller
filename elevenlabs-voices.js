// ElevenLabs Voice ID mapping
export const ELEVENLABS_VOICES = {
  jessica: {
    id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    description: 'Professional, clear, customer service focused'
  },
  rachel: {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel', 
    description: 'Warm, friendly, natural'
  },
  domi: {
    id: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    description: 'Young, energetic'
  },
  bella: {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    description: 'Soft, pleasant'
  },
  antoni: {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    description: 'Male, professional'
  },
  elli: {
    id: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Elli',
    description: 'Young, cheerful'
  },
  josh: {
    id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    description: 'Male, deep, authoritative'
  },
  arnold: {
    id: 'VR6AewLTigWG4xSOukaG',
    name: 'Arnold',
    description: 'Male, mature, commanding'
  },
  adam: {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    description: 'Male, calm, professional'
  },
  sam: {
    id: 'yoZ06aMxZJJ28mfd3POQ',
    name: 'Sam',
    description: 'Male, friendly, conversational'
  }
};

// Get voice ID by name
export function getElevenLabsVoiceId(voiceName) {
  const voice = ELEVENLABS_VOICES[voiceName?.toLowerCase()];
  return voice ? voice.id : ELEVENLABS_VOICES.jessica.id; // Default to Jessica
}

// Get voice info by name
export function getElevenLabsVoiceInfo(voiceName) {
  const voice = ELEVENLABS_VOICES[voiceName?.toLowerCase()];
  return voice || ELEVENLABS_VOICES.jessica; // Default to Jessica
}

console.log('📝 ElevenLabs voices mapping loaded');
console.log('Available voices:', Object.keys(ELEVENLABS_VOICES));