/**
 * @module agent/tools
 * @description Tool definitions for the SENTINEL-CIVIC agent.
 *
 * Each tool is defined in Gemini function-calling format with a name,
 * description, and JSON Schema parameters. These definitions are passed
 * to the LLM so it can decide which tools to invoke.
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'classify_issue',
    description: 'Classify a civic issue from media (image/video) and/or text description. Returns the issue category, severity, confidence score, and reasoning.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text description of the issue from the citizen report',
        },
        has_media: {
          type: 'boolean',
          description: 'Whether the report includes image or video media',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'geo_resolve',
    description: 'Resolve geographic coordinates to a human-readable address, ward name, and responsible department.',
    parameters: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude in degrees' },
        lng: { type: 'number', description: 'Longitude in degrees' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'find_cluster',
    description: 'Check if a new report is a duplicate of an existing issue by running DBSCAN spatiotemporal clustering. Returns the matching cluster/ticket ID if found.',
    parameters: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Report latitude' },
        lng: { type: 'number', description: 'Report longitude' },
        category: { type: 'string', description: 'Issue category' },
        timestamp: { type: 'string', description: 'ISO 8601 timestamp of the report' },
      },
      required: ['lat', 'lng', 'category', 'timestamp'],
    },
  },
  {
    name: 'compute_priority',
    description: 'Compute the priority score (0-100) for a ticket based on severity, report count, community votes, SLA status, and safety risk.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket ID to compute priority for' },
      },
      required: ['ticket_id'],
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a new ticket in the system for a verified civic issue. Returns the new ticket ID.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Concise title for the issue' },
        description: { type: 'string', description: 'Detailed description of the issue' },
        category: { type: 'string', enum: ['pothole', 'water_leak', 'streetlight', 'waste', 'road_damage', 'drainage', 'other'] },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
        address: { type: 'string', description: 'Resolved address' },
        ward: { type: 'string', description: 'Ward name' },
        department: { type: 'string', description: 'Responsible department' },
      },
      required: ['title', 'description', 'category', 'severity', 'lat', 'lng'],
    },
  },
  {
    name: 'merge_into_ticket',
    description: 'Merge a new report into an existing ticket as a duplicate. Increments the report count and updates priority.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The existing ticket to merge into' },
        reason: { type: 'string', description: 'Why this report is considered a duplicate' },
      },
      required: ['ticket_id', 'reason'],
    },
  },
  {
    name: 'record_verification',
    description: 'Record a community verification vote on a ticket.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket being verified' },
        vote_type: { type: 'string', enum: ['still_issue', 'looks_resolved'], description: 'The verification vote' },
      },
      required: ['ticket_id', 'vote_type'],
    },
  },
  {
    name: 'check_sla_status',
    description: 'Check the SLA status of a ticket using the Weibull time-to-resolution model. Returns the probability of resolution by the deadline and whether SLA is breached.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket to check' },
      },
      required: ['ticket_id'],
    },
  },
  {
    name: 'escalate_ticket',
    description: 'Escalate a ticket to higher priority due to SLA breach, safety concern, or community dispute.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket to escalate' },
        reason: { type: 'string', description: 'Reason for escalation' },
      },
      required: ['ticket_id', 'reason'],
    },
  },
  {
    name: 'notify_reporters',
    description: 'Send a real-time notification to all users watching a ticket about a status update.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket that was updated' },
        status: { type: 'string', description: 'The new status or update message' },
      },
      required: ['ticket_id', 'status'],
    },
  },
  {
    name: 'flag_for_review',
    description: 'Flag a ticket for human review due to classification disagreement between AI models, high dispute count, or other anomalies.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket to flag' },
        reason: { type: 'string', description: 'Why the ticket needs review' },
      },
      required: ['ticket_id', 'reason'],
    },
  },
  {
    name: 'query_recurrence_risk',
    description: 'Query the recurrence-risk survival model for a specific ward and category. Returns the probability of a new issue within the forecast window.',
    parameters: {
      type: 'object',
      properties: {
        ward: { type: 'string', description: 'Ward name' },
        category: { type: 'string', description: 'Issue category' },
      },
      required: ['ward', 'category'],
    },
  },
  {
    name: 'query_ward_historical_stats',
    description: 'Query historical metrics for a specific ward and category to audit averages and check for anomaly/outlier thresholds.',
    parameters: {
      type: 'object',
      properties: {
        ward: { type: 'string', description: 'Ward name' },
        category: { type: 'string', description: 'Issue category' },
      },
      required: ['ward', 'category'],
    },
  },
  {
    name: 'audit_ticket_details',
    description: 'Query details of an existing ticket in the database to double-check classification or priority anomalies.',
    parameters: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string', description: 'The ticket ID to audit' },
      },
      required: ['ticket_id'],
    },
  }
];

/**
 * Get tool definitions for a specific context.
 *
 * @param {'report'|'scheduler'|'all'} context — which tools to include
 * @returns {Object[]}
 */
export function getToolsForContext(context) {
  const reportTools = [
    'classify_issue', 'geo_resolve', 'find_cluster', 'compute_priority',
    'create_ticket', 'merge_into_ticket', 'notify_reporters', 'flag_for_review',
    'query_ward_historical_stats', 'audit_ticket_details'
  ];

  const schedulerTools = [
    'check_sla_status', 'compute_priority', 'escalate_ticket',
    'notify_reporters', 'flag_for_review', 'query_recurrence_risk',
    'query_ward_historical_stats', 'audit_ticket_details'
  ];

  if (context === 'report') {
    return TOOL_DEFINITIONS.filter(t => reportTools.includes(t.name));
  }
  if (context === 'scheduler') {
    return TOOL_DEFINITIONS.filter(t => schedulerTools.includes(t.name));
  }
  return TOOL_DEFINITIONS;
}

