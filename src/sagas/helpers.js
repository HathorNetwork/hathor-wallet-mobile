// Helper method to wait until a specific action with a specific payload, this should be a helper
export const specificTypeAndPayload = (type, payload) => (action) => (
  action.payload === payload && action.type === type
);
