export const AI_TASK_TYPES = Object.freeze({
  CONVERSATION: 'conversation',
  EXTRACTION_EVENT: 'extraction_event',
  DEEP_ANALYSIS: 'deep_analysis',
  SCIENTIFIC_ANSWER: 'scientific_answer',
});

export const DEFAULT_MODEL_ROUTES = Object.freeze({
  [AI_TASK_TYPES.CONVERSATION]: Object.freeze({ capabilityTier: 'economy', providerId: 'openai', modelId: 'backend-default', useScientificContext: false }),
  [AI_TASK_TYPES.EXTRACTION_EVENT]: Object.freeze({ capabilityTier: 'structured', providerId: null, modelId: null, useScientificContext: false }),
  [AI_TASK_TYPES.DEEP_ANALYSIS]: Object.freeze({ capabilityTier: 'advanced', providerId: null, modelId: null, useScientificContext: false }),
  [AI_TASK_TYPES.SCIENTIFIC_ANSWER]: Object.freeze({ capabilityTier: 'advanced', providerId: null, modelId: null, useScientificContext: true }),
});

export function resolveModelRoute(taskType, routes = DEFAULT_MODEL_ROUTES) {
  if (!Object.values(AI_TASK_TYPES).includes(taskType)) throw new Error(`Unsupported AI task type: ${String(taskType)}`);
  const route = routes?.[taskType];
  if (!route || typeof route !== 'object') throw new Error(`No model route configured for task: ${taskType}`);
  return { taskType, capabilityTier: route.capabilityTier || 'economy', providerId: route.providerId || null, modelId: route.modelId || null, useScientificContext: route.useScientificContext === true };
}
