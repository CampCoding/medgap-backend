# Copy Deck API Documentation

## Copy Deck by ID

This endpoint allows students to copy an existing deck (with all its flashcards) to their personal collection.

### Endpoint
```
POST /api/student/flashcards/copy-deck/:deck_id
```

### Authentication
- Requires valid student JWT token in Authorization header
- Format: `Bearer <token>`

### URL Parameters
- `deck_id` (required): The ID of the deck to copy

### Request Body
```json
{
  "deck_title": "My Copy of Medical Deck", // Optional, defaults to "Original Title (Copy)"
  "deck_description": "Personal copy for study" // Optional, defaults to "Copy of 'Original Title'"
}
```

### Response

#### Success Response (201 Created)
```json
{
  "status": "success",
  "message": "Successfully copied deck \"Medical Basics\" with 25 flashcards",
  "data": {
    "new_deck_id": 456,
    "copied_cards": 25,
    "source_deck": {
      "deck_id": 123,
      "deck_title": "Medical Basics",
      "total_cards": 25
    },
    "new_deck": {
      "deck_id": 456,
      "deck_title": "Medical Basics (Copy)",
      "deck_description": "Copy of \"Medical Basics\""
    }
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

**400 Bad Request - Invalid Deck ID**
```json
{
  "status": "error",
  "message": "Invalid deck ID",
  "data": null,
  "error": "Invalid parameter"
}
```

**400 Bad Request - Deck Not Found**
```json
{
  "status": "error",
  "message": "Source deck not found",
  "data": null,
  "error": "Deck does not exist"
}
```

**500 Internal Server Error**
```json
{
  "status": "error",
  "message": "Failed to copy deck",
  "data": null,
  "error": "Database error occurred"
}
```

### How It Works

1. **Authentication**: Verifies the student's JWT token
2. **Validation**: Validates the deck ID parameter
3. **Source Deck Retrieval**: Fetches the source deck information and card count
4. **New Deck Creation**: Creates a new deck for the student with custom or default title/description
5. **Card Copying**: 
   - Retrieves all flashcards from the source deck
   - Preserves all card data (front, back, difficulty, etc.)
   - Updates tags to include source information
   - Resets progress tracking (status, solved, repetitions, etc.)
6. **Batch Insert**: Efficiently inserts all copied cards

### Features

- **Complete Data Preservation**: All card content, difficulty, and metadata are preserved
- **Source Tracking**: Original deck information is stored in card tags
- **Progress Reset**: Copied cards start fresh with 'not_seen' status
- **Custom Naming**: Optional custom deck title and description
- **Batch Processing**: Efficient database operations for large decks
- **Error Handling**: Comprehensive validation and error responses

### Database Tables Used

- **Source Tables**: `student_deck`, `student_flash_cards`
- **Target Tables**: `student_deck`, `student_flash_cards`

### Example Usage

```javascript
// Using fetch
const response = await fetch('/api/student/flashcards/copy-deck/123', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deck_title: 'My Study Copy',
    deck_description: 'Personal copy for exam preparation'
  })
});

const result = await response.json();
console.log(`Copied ${result.data.copied_cards} cards to new deck ${result.data.new_deck_id}`);
```

### Card Tags After Copy

Each copied card will have updated tags containing:
```json
{
  "original_tags": "...", // Any existing tags
  "copied_from_deck_id": 123,
  "copied_from_deck_title": "Original Deck Name",
  "copied_at": "2024-01-15T10:30:00.000Z"
}
```

### Notes

- The source deck can belong to any student (not just the requesting student)
- All copied cards start with fresh progress tracking
- Original card metadata (difficulty, ease_factor, etc.) is preserved
- The copy operation creates a completely independent deck
- Cards are copied in their original order
- No limit on deck size - can copy decks with hundreds of cards
