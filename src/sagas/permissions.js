import { Platform } from 'react-native';
import { check, PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import {
  all,
  put,
  select,
  takeLatest,
} from 'redux-saga/effects';
import { setCameraAvailable, types } from '../actions';

/**
 * Checks the current permissions for the camera and sets the results on redux.
 * If permission is not granted, but requireable, requests the permission from the user.
 * Sets the redux property IS_CAMERA_AVAILABLE to True if the app has permission to use the camera
 *
 * For a complete description on all possible permition statuses,
 * @see https://github.com/zoontek/react-native-permissions#permissions-statuses
 */
export function* requestCameraPermissions() {
  const checkStatus = async (status) => {
    switch (status) {
      case RESULTS.GRANTED:
        return true;
      case RESULTS.DENIED: // The permission has not been requested / is denied but requestable
        return checkStatus(await request(platformCameraPermission));
      default:
        return false;
    }
  };

  // Checking redux to see if the permission was already requested before
  const isCameraAlreadyAvailable = yield select((state) => state.isCameraAvailable);
  if (isCameraAlreadyAvailable !== null) {
    // The permission was already defined, no further processing or request necessary
    return;
  }

  const platformCameraPermission = Platform.OS === 'android'
    ? PERMISSIONS.ANDROID.CAMERA
    : PERMISSIONS.IOS.CAMERA;

  // Checks the current permission and, if necessary/possible, request it again.
  const currentStatus = yield check(platformCameraPermission);
  const isCameraAvailable = yield checkStatus(currentStatus);

  // Updates redux with the check/request results
  yield put(setCameraAvailable(isCameraAvailable));
}

export function* saga() {
  yield all([
    takeLatest(types.CAMERA_PERMISSION_REQUESTED, requestCameraPermissions),
  ]);
}
