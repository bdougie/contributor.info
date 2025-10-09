import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function resetCount() {
  const jobId = '3fd06b7c-acb3-46a2-bcad-0958d171e137';

  const { error } = await supabase
    .from('embedding_jobs')
    .update({ items_processed: 0 })
    .eq('id', jobId);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Reset items_processed to 0 for job', jobId);
  }
}

await resetCount();
