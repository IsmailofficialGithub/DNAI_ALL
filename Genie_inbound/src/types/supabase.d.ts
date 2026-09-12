// Type declaration for @supabase/supabase-js
// This is a workaround if TypeScript can't find the module types

declare module '@supabase/supabase-js' {
  export interface User {
    id: string;
    email?: string;
    [key: string]: any;
  }

  export interface Session {
    access_token: string;
    refresh_token: string;
    user: User | null;
    expires_at?: number;
    [key: string]: any;
  }

  export type AuthChangeEvent = 
    | 'INITIAL_SESSION'
    | 'SIGNED_IN'
    | 'SIGNED_OUT'
    | 'TOKEN_REFRESHED'
    | 'USER_UPDATED'
    | 'PASSWORD_RECOVERY';

  export interface SupabaseClientOptions {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
  }

  export interface StorageBucket {
    from(bucket: string): {
      upload(path: string, file: File, options?: any): Promise<{ data: any; error: any }>;
      remove(paths: string[]): Promise<{ data: any; error: any }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  }

  export interface SupabaseClient {
    auth: {
      getSession(): Promise<{ data: { session: Session | null }; error: any }>;
      getUser(): Promise<{ data: { user: User | null }; error: any }>;
      signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: any; error: any }>;
      signUp(options: { email: string; password: string; options?: any }): Promise<{ data: any; error: any }>;
      signOut(): Promise<{ error: any }>;
      resetPasswordForEmail(email: string, options?: any): Promise<{ error: any }>;
      updateUser(options: { password?: string }): Promise<{ data: any; error: any }>;
      onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
        data: { subscription: { unsubscribe: () => void } };
      };
    };
    storage: StorageBucket;
    from(table: string): any;
    rpc(functionName: string, params?: any): Promise<any>;
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: SupabaseClientOptions
  ): SupabaseClient;
}
