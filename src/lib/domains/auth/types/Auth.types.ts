export interface LoginResponse {
  temp_token: string;
}

export interface Verify2FAResponse {
  access_token: string;
}

export interface AuthError {
  message: string;
}
