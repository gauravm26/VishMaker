export interface User {
    id: string;
    email: string;
    // any other user properties you want to expose
  }
  
  export interface IAuthService {
    signIn(email: string, password: string): Promise<User>;
    signUp(email: string, password: string): Promise<{ userConfirmed: boolean; userId: string }>;
    confirmSignUp(email: string, confirmationCode: string): Promise<void>;
    signOut(): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>;
    getCurrentAuthenticatedUser(): Promise<User | null>;
  }