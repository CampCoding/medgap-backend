# Flashcard Import API Documentation

## Import All Libraries to Personal Deck

This endpoint allows students to import all active flashcard libraries from the system into their personal deck.

### Endpoint
```
POST /api/student/flashcards/import-all-to-deck
```

### Authentication
- Requires valid student JWT token in Authorization header
- Format: `Bearer <token>`

### Request Body
```json
{
  "deck_title": "My Imported Flashcards", // Optional, defaults to "Imported Flashcards"
  "deck_description": "All flashcard libraries imported to personal deck" // Optional
}
```

### Response

#### Success Response (201 Created)
```json
{
  "status": "success",
  "message": "Successfully imported 3 libraries with 45 flashcards",
  "data": {
    "deck_id": 123,
    "imported_libraries": 3,
    "imported_cards": 45,
    "libraries": [
      {
        "library_id": 1,
        "library_name": "Medical Basics",
        "cards_count": 20
      },
      {
        "library_id": 2,
        "library_name": "Anatomy",
        "cards_count": 15
      },
      {
        "library_id": 3,
        "library_name": "Pharmacology",
        "cards_count": 10
      }
    ]
  },
  "error": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Error Responses

**401 Unauthorized**
```json
{
  "status": "error",
  "message": "Unauthorized: invalid token",
  "data": null,
  "error": "Authentication failed"
}
```

**400 Bad Request**
```json
{
  "status": "error",
  "message": "No active flashcard libraries found",
  "data": null,
  "error": "No data to import"
}
```

**500 Internal Server Error**
```json
{
  "status": "error",
  "message": "Failed to import libraries to deck",
  "data": null,
  "error": "Database error occurred"
}
```

### How It Works

1. **Authentication**: Verifies the student's JWT token
2. **Deck Creation**: Creates a new personal deck for the student
3. **Data Retrieval**: Fetches all active flashcard libraries and their cards
4. **Import Process**: 
   - Groups cards by library
   - Converts system flashcards to personal flashcards
   - Preserves original metadata in tags field
   - Sets appropriate default values for personal deck
5. **Batch Insert**: Efficiently inserts all cards in a single operation

### Features

- **Preserves Original Data**: Original library and flashcard IDs are stored in the tags field
- **Maintains Order**: Cards are imported in their original order
- **Difficulty Mapping**: Preserves difficulty levels from original cards
- **Batch Processing**: Efficient database operations for large imports
- **Error Handling**: Comprehensive error handling and validation

### Database Tables Used

- **Source Tables**: `flashcard_libraries`, `flashcards`
- **Target Tables**: `student_deck`, `student_flash_cards`

### Example Usage

```javascript
// Using fetch
const response = await fetch('/api/student/flashcards/import-all-to-deck', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deck_title: 'My Study Deck',
    deck_description: 'All medical flashcards for exam preparation'
  })
});

const result = await response.json();
console.log(`Imported ${result.data.imported_cards} cards from ${result.data.imported_libraries} libraries`);
```

### Notes

- Only active flashcard libraries are imported
- Only active/draft flashcards are included
- The import creates a new deck each time (doesn't update existing decks)
- Original flashcard metadata is preserved in the tags field
- All imported cards start with 'not_seen' status
- Cards are ready for spaced repetition learning
