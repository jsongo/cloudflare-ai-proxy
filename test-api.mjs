// Simple test script for the DeepSeek API
// Run with: node test-api.mjs

import fetch from 'node-fetch';

async function testChatCompletions() {
  console.log('Testing chat completions endpoint...');
  
  const response = await fetch('http://localhost:8787/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'user', content: 'What is the capital of France?' }
      ],
      stream: false,
      max_tokens: 100
    })
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

async function testStreamingChatCompletions() {
  console.log('Testing streaming chat completions endpoint...');
  
  const response = await fetch('http://localhost:8787/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'user', content: 'Write a short poem about AI.' }
      ],
      stream: true,
      max_tokens: 100
    })
  });

  // For Node.js, we need to handle the stream differently
  console.log('Streaming response:');
  
  // Convert the response to text and log it
  const text = await response.text();
  console.log(text);
}

// Run the tests
async function runTests() {
  try {
    await testChatCompletions();
    console.log('\n-----------------------------------\n');
    await testStreamingChatCompletions();
  } catch (error) {
    console.error('Error:', error);
  }
}

runTests();
