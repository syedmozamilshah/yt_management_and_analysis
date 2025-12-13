// Editor-only TypeScript declarations to silence VS Code errors for Deno edge functions.
// These do not affect deployment; Supabase runs Deno with proper types.

declare const Deno: {
  env: { get(name: string): string | undefined };
};

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  import type { SupabaseClient } from '@supabase/supabase-js';
  export function createClient(url: string, key: string): SupabaseClient;
}
