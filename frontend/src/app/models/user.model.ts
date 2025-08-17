export interface User {
  id: number;
  username: string;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
  is_admin: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}