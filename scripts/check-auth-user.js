#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthUser() {
  // Get the current session from cookies/localStorage
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('❌ Error getting session:', sessionError.message);
    return;
  }
  
  if (!session) {
    console.log('⚠️ No active session found. You need to log in first.');
    console.log('💡 Visit https://contributor.info and log in with GitHub');
    return;
  }
  
  console.log('✅ Current authenticated user:');
  console.log('   User ID:', session.user.id);
  console.log('   Email:', session.user.email);
  console.log('   GitHub username:', session.user.user_metadata?.user_name);
  
  // Check workspace membership
  const { data: workspaces, error: wsError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name, slug)')
    .eq('user_id', session.user.id);
    
  if (wsError) {
    console.error('❌ Error checking workspaces:', wsError.message);
    return;
  }
  
  if (!workspaces || workspaces.length === 0) {
    console.log('\n⚠️ User is not a member of any workspaces');
    console.log('💡 To fix this, we need to add your user ID to the workspace_members table');
    console.log(`   User ID to add: ${session.user.id}`);
  } else {
    console.log('\n✅ User is member of', workspaces.length, 'workspace(s):');
    workspaces.forEach(ws => {
      console.log(`   - ${ws.workspaces?.name} (${ws.role})`);
    });
  }
}

checkAuthUser();