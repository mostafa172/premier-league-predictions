export interface User {
    id: number;
    username: string;
    email: string;
    password: string;
    is_admin: boolean;
    created_at: Date;
    updated_at: Date;
  }
  
  export interface CreateUserDto {
    username: string;
    email: string;
    password: string;
  }
  
  export interface LoginDto {
    email: string;
    password: string;
  }