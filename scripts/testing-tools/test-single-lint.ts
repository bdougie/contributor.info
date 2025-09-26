// Test file to verify ESLint rule catches .single() usage

// Example function that demonstrates ESLint rule violation
// Uncomment to test the lint rule:
// async function testFunction() {
//   // This should trigger an ESLint error
//   const { data, error } = await supabase.from('repositories').select('*').eq('id', '123').single(); // <-- This should be caught by ESLint
//   return data;
// }

// Example of correct function - commented out as it's for reference only
// async function correctFunction() {
//   // This should NOT trigger an error
//   const { data, error } = await supabase
//     .from('repositories')
//     .select('*')
//     .eq('id', '123')
//     .maybeSingle(); // <-- This is correct
//
//   if (error) {
//     console.error('Error:', error);
//   }
//   return data;
// }
