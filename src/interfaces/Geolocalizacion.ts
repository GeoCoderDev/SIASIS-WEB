export interface GeographicPoint {
  latitude: number;
  longitude: number;
}


// src/enums/GeolocationEnums.ts

/**
 * Possible states of the device in relation to geolocation
 */
export enum DeviceStatus {
  INSIDE_THE_SCHOOL = 'INSIDE_THE_SCHOOL',
  OUTSIDE_THE_SCHOOL = 'OUTSIDE_THE_SCHOOL',
  UNKNOWN_LOCATION = 'UNKNOWN_LOCATION',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  POSITION_UNAVAILABLE_ERROR = 'POSITION_UNAVAILABLE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  LOADING = 'LOADING'
}

/**
 * Geolocation permission states
 */
export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  PROMPT = 'prompt',
  NOT_SUPPORTED = 'not-supported'
}

/**
 * Geolocation error types
 */
export enum GeolocationErrorType {
  PERMISSION_DENIED = 1,
  POSITION_UNAVAILABLE = 2,
  TIMEOUT = 3
}

/**
 * Types of modals to display
 */
export enum ModalType {
  WELCOME_INSIDE_SCHOOL = 'WELCOME_INSIDE_SCHOOL',
  ALERT_OUTSIDE_SCHOOL = 'ALERT_OUTSIDE_SCHOOL',
  LOCATION_PERMISSION_ERROR = 'LOCATION_PERMISSION_ERROR',
  LOCATION_UNAVAILABLE_ERROR = 'LOCATION_UNAVAILABLE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  LOADING_LOCATION = 'LOADING_LOCATION',
  GENERIC_ERROR = 'GENERIC_ERROR'
}

/**
 * Available actions in modals
 */
export enum ModalAction {
  RETRY = 'RETRY',
  CONFIGURE_PERMISSIONS = 'CONFIGURE_PERMISSIONS',
  CONTINUE = 'CONTINUE',
  CANCEL = 'CANCEL',
  CLOSE = 'CLOSE'
}