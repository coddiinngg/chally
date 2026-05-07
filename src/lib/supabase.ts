import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] 환경변수 SUPABASE_URL / SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);
