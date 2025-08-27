// Test file to verify ESLint rule catches .single() usage
import { supabase } from './src/lib/supabase';

async function testFunction() {
  // This should trigger an ESLint error
  const { data, error } = await supabase.from('repositories').select('*').eq('id', '123').single(); // <-- This should be caught by ESLint

  return data;
}

async function correctFunction() {
  // This should NOT trigger an error
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .eq('id', '123')
    .maybeSingle(); // <-- This is correct

  return data;
}
