// Test the fixed copy functionality
const axios = require('axios');

const BASE_URL = 'http://localhost:3120/api/student/flashcards';

async function testCopyLibrary() {
  try {
    console.log('🧪 Testing library copy functionality...');
    
    // You'll need to replace this with a valid student JWT token
    const studentToken = 'YOUR_STUDENT_JWT_TOKEN_HERE';
    
    // First, list all libraries to see what's available
    console.log('📋 Listing all available libraries...');
    const listResponse = await axios.get(`${BASE_URL}/libraries`, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Available libraries:', listResponse.data.data.map(l => ({
      id: l.library_id,
      name: l.library_name,
      cards: l.total_cards
    })));
    
    if (listResponse.data.data.length === 0) {
      console.log('❌ No libraries found. You may need to create some first.');
      return;
    }
    
    // Try to copy the first library
    const firstLibrary = listResponse.data.data[0];
    console.log(`\n📋 Copying library: "${firstLibrary.library_name}" (ID: ${firstLibrary.library_id})`);
    
    const copyResponse = await axios.post(`${BASE_URL}/copy-deck/${firstLibrary.library_id}`, {
      deck_title: 'Test Copy Deck',
      deck_description: 'Testing the copy functionality'
    }, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Copy successful!');
    console.log('Response:', JSON.stringify(copyResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
console.log('🚀 Starting copy functionality test...\n');
testCopyLibrary();
