// Test file to verify ESLint rule catches .single() usage
import { supabase } from './src/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function testFunction() {
  // This should trigger an ESLint error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .eq('id', '123')
    .maybeSingle(); // Fixed: Changed from .single() to .maybeSingle()
    
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function correctFunction() {
  // This should NOT trigger an error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .eq('id', '123')
    .maybeSingle(); // <-- This is correct
    
  return data;
}