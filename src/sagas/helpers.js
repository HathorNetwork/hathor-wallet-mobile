// Helper method to wait until a specific action with a specific payload, this should be a helper
export const specificTypeAndPayload = (type, payload) => (action) => {
  if (type !== action.type) {
    return false;
  }

  const keys = Object.keys(action);

  for (const key of keys) {
    if (key === 'type') {
      continue;
    }

    if (action.payload[key] !== payload[key]) {
      return false;
    }
  }

  return true;
};
