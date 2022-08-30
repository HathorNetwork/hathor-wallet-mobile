import { get } from 'lodash';
// Helper method to wait until a specific action with a specific payload, this should be a helper
export const specificTypeAndPayload = (type, payload) => (action) => {
  if (type !== action.type) {
    return false;
  }

  const keys = Object.keys(payload);

  for (const key of keys) {
    if (get(action, key) !== get(payload, key)) {
      return false;
    }
  }

  return true;
};
