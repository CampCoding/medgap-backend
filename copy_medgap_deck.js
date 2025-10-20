// Test script to find and copy medgap library
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/student/flashcards';

async function findAndCopyMedgapLibrary() {
  try {
    console.log('🔍 Looking for flashcard libraries with "medgap" in the name...');
    
    // You'll need to replace this with a valid student JWT token
    const studentToken = 'YOUR_STUDENT_JWT_TOKEN_HERE';
    
    // First, list all libraries to find the medgap library
    const listResponse = await axios.get(`${BASE_URL}/libraries?search=medgap`, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Available libraries:', JSON.stringify(listResponse.data, null, 2));
    
    // Look for medgap library
    const medgapLibrary = listResponse.data.data.find(library => 
      library.library_name.toLowerCase().includes('medgap')
    );
    
    if (!medgapLibrary) {
      console.log('❌ No library found with "medgap" in the name');
      console.log('Available libraries:', listResponse.data.data.map(l => l.library_name));
      return;
    }
    
    console.log(`✅ Found medgap library: "${medgapLibrary.library_name}" (ID: ${medgapLibrary.library_id})`);
    console.log(`📊 Library has ${medgapLibrary.total_cards} cards`);
    
    // Copy the library
    console.log('📋 Copying library to your personal collection...');
    
    const copyResponse = await axios.post(`${BASE_URL}/copy-deck/${medgapLibrary.library_id}`, {
      deck_title: 'My Medgap Deck',
      deck_description: 'Personal copy of medgap library for study'
    }, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Copy successful!');
    console.log('Response:', JSON.stringify(copyResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Alternative: Copy by specific library ID if you know it
async function copyLibraryById(libraryId) {
  try {
    console.log(`📋 Copying library ID ${libraryId}...`);
    
    const studentToken = 'YOUR_STUDENT_JWT_TOKEN_HERE';
    
    const response = await axios.post(`${BASE_URL}/copy-deck/${libraryId}`, {
      deck_title: 'My Medgap Deck',
      deck_description: 'Personal copy for study'
    }, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Copy successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the functions
console.log('🚀 Starting medgap library copy process...\n');

// Method 1: Search for medgap library
findAndCopyMedgapLibrary();

// Method 2: Copy by specific ID (uncomment and replace with actual library ID)
// copyLibraryById(123);
