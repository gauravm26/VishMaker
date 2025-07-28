export interface User {
    id: string;
    email: string;
    // any other user properties you want to expose
  }
  
  export interface IAuthService {
    signIn(email: string, password: string): Promise<User>;
    signOut(): Promise<void>;
    getCurrentAuthenticatedUser(): Promise<User | null>;
  }