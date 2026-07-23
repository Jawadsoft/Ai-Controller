import DAIVEService from '../daivecrewai.js';

// Minimal mock settingsManager to avoid DB lookups in unit test environment
class MockSettingsManager {
  async getVoiceSettings() { return { enabled: false, provider: 'elevenlabs', voiceSpeed: 1.0 }; }
  async getTTSSettings() { return { ttsProvider: 'elevenlabs', elevenlabsVoice: 'mark' }; }
  async getAPIKeys() { return { elevenlabs: null, openai: null, deepgram: null }; }
}

// Monkey patch settingsManager on DAIVEService prototype if available
DAIVEService.prototype.settingsManager = new MockSettingsManager();

describe('Policy fallback - no fabricated inventory', () => {
  test('budget-only query yields prompt (no listing)', async () => {
    const service = new DAIVEService();
    // Force empty inventory in memory and skip initialization side-effects
    service.inventoryService.inventory = new Map();
    service.inventoryService.dealerInventories = new Map();

    const sessionId = 'test_sess';
    const vehicleId = null;
    const message = 'my budget is 20000';
    const customerInfo = { dealerId: null };

    const result = await service.processConversationWithOptimizedCrew(
      sessionId, vehicleId, message, customerInfo
    );

    // Should not include fake list items or stock numbers
    expect(result.response).not.toMatch(/Stock #/i);
    expect(result.response).not.toMatch(/\*\*\d{4}\s+/); // bullet vehicle lines
    expect(result.response.toLowerCase()).toMatch(/make\/model|specific make|confirm availability/);
  });
});


