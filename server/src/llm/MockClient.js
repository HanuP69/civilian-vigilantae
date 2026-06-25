import { LLMClient } from './LLMClient.js';

export class MockClient extends LLMClient {
  async chat(messages, tools) {
    console.log('[MockClient] Processing chat request...');
    
    // Simulate some delay
    await new Promise(r => setTimeout(r, 500));

    // If it's a scheduler request, do nothing
    if (messages.find(m => m.content && m.content.includes('Scheduler tick'))) {
      return { toolCalls: [], text: 'Mock scheduler complete.' };
    }

    // Determine what stage we're in by looking at the last tool call
    const lastTool = [...messages].reverse().find(m => m.role === 'tool');

    if (!lastTool) {
      // Step 1: Classify
      return {
        toolCalls: [{ name: 'classify_issue', args: { text: messages[1]?.content || '' } }],
        text: 'Let me classify this issue first.'
      };
    }

    if (lastTool.name === 'classify_issue') {
      return {
        toolCalls: [{ name: 'geo_resolve', args: { lat: 26.8500, lng: 80.9450 } }],
        text: 'Classified. Now resolving location.'
      };
    }

    if (lastTool.name === 'geo_resolve') {
      return {
        toolCalls: [{ name: 'find_cluster', args: { lat: 26.8500, lng: 80.9450, category: 'pothole', timestamp: new Date().toISOString() } }],
        text: 'Location resolved. Checking for clusters.'
      };
    }

    if (lastTool.name === 'find_cluster') {
      return {
        toolCalls: [{
          name: 'create_ticket', 
          args: { 
            title: 'Massive Pothole', 
            description: 'Massive pothole near main intersection', 
            category: 'road_damage', 
            severity: 'high', 
            lat: 26.8500, 
            lng: 80.9450, 
            address: 'Hazratganj, Lucknow', 
            ward: 'Hazratganj' 
          }
        }],
        text: 'No cluster found. Creating new ticket.'
      };
    }

    if (lastTool.name === 'create_ticket') {
      const ticketId = JSON.parse(lastTool.content).ticket_id;
      return {
        toolCalls: [{ name: 'compute_priority', args: { ticket_id: ticketId } }],
        text: 'Ticket created. Computing priority.'
      };
    }

    if (lastTool.name === 'compute_priority') {
      return {
        toolCalls: [],
        text: 'Processing complete. The issue has been routed successfully.'
      };
    }

    return { toolCalls: [], text: 'Unknown state, stopping.' };
  }

  async chatWithMedia(text, media, tools) {
    return this.chat([{ role: 'user', content: text }], tools);
  }
}
