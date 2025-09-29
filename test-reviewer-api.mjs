#!/usr/bin/env node
import fetch from 'node-fetch';

async function testReviewerSuggestions() {
  const apiUrl = 'http://localhost:8888/api/repos/open-sauced/app/suggest-reviewers';

  const testData = {
    files: [
      'src/components/Header.tsx',
      'src/lib/auth.ts',
      'src/pages/index.tsx'
    ],
    prAuthor: 'testuser'
  };

  try {
    console.log('Testing reviewer suggestions API...');
    console.log('Request:', testData);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', response.status, error);
      return;
    }

    const data = await response.json();
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));

    if (data.suggestions && data.suggestions.length > 0) {
      console.log('\n✅ Reviewer Suggestions Found:');
      data.suggestions.forEach((suggestion, index) => {
        console.log(`\n${index + 1}. ${suggestion.handle}`);
        console.log(`   Reason: ${suggestion.reason}`);
        console.log(`   Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
        console.log(`   Signals: ${suggestion.signals.join(', ')}`);
      });
    } else {
      console.log('\n⚠️  No suggestions returned - this may be because there are no reviews in the database for this repository');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testReviewerSuggestions();