// Test script to find and copy medgap deck
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/student/flashcards';

async function findAndCopyMedgapDeck() {
  try {
    console.log('🔍 Looking for decks with "medgap" in the name...');
    
    // You'll need to replace this with a valid student JWT token
    const studentToken = 'YOUR_STUDENT_JWT_TOKEN_HERE';
    
    // First, list all decks to find the medgap deck
    const listResponse = await axios.get(`${BASE_URL}/decks?search=medgap`, {
      headers: {
        'Authorization': `Bearer ${studentToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📋 Available decks:', JSON.stringify(listResponse.data, null, 2));
    
    // Look for medgap deck
    const medgapDeck = listResponse.data.data.find(deck => 
      deck.deck_title.toLowerCase().includes('medgap')
    );
    
    if (!medgapDeck) {
      console.log('❌ No deck found with "medgap" in the name');
      console.log('Available decks:', listResponse.data.data.map(d => d.deck_title));
      return;
    }
    
    console.log(`✅ Found medgap deck: "${medgapDeck.deck_title}" (ID: ${medgapDeck.deck_id})`);
    console.log(`📊 Deck has ${medgapDeck.total_cards} cards`);
    
    // Copy the deck
    console.log('📋 Copying deck to your personal collection...');
    
    const copyResponse = await axios.post(`${BASE_URL}/copy-deck/${medgapDeck.deck_id}`, {
      deck_title: 'My Medgap Deck',
      deck_description: 'Personal copy of medgap deck for study'
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

// Alternative: Copy by specific deck ID if you know it
async function copyDeckById(deckId) {
  try {
    console.log(`📋 Copying deck ID ${deckId}...`);
    
    const studentToken = 'YOUR_STUDENT_JWT_TOKEN_HERE';
    
    const response = await axios.post(`${BASE_URL}/copy-deck/${deckId}`, {
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
console.log('🚀 Starting medgap deck copy process...\n');

// Method 1: Search for medgap deck
findAndCopyMedgapDeck();

// Method 2: Copy by specific ID (uncomment and replace with actual deck ID)
// copyDeckById(123);
