# Copy Medgap Library to Personal Deck - Complete Guide

## ✅ **Fixed Issues**

1. **Database Connection Error**: Reduced MySQL connection limit from 10 to 5 to prevent "too many connections" error
2. **Library Copying**: Updated the copy function to work with `flashcard_libraries` instead of `student_deck`
3. **Proper Data Mapping**: Fixed field mappings between library and deck structures

## 🚀 **How to Copy Medgap Library**

### **Step 1: Find Available Libraries**
```bash
GET /api/student/flashcards/libraries?search=medgap
```

This will show you all flashcard libraries with "medgap" in the name.

### **Step 2: Copy the Library**
```bash
POST /api/student/flashcards/copy-deck/{library_id}
```

**Request Body:**
```json
{
  "deck_title": "My Medgap Deck",
  "deck_description": "Personal copy of medgap library for study"
}
```

## 📋 **Available Endpoints**

### **List All Libraries**
```
GET /api/student/flashcards/libraries
GET /api/student/flashcards/libraries?search=medgap
```

**Response:**
```json
{
  "status": "success",
  "message": "Found 3 flashcard libraries",
  "data": [
    {
      "library_id": 1,
      "library_name": "Medgap Medical Basics",
      "description": "Basic medical concepts",
      "difficulty_level": "medium",
      "total_cards": 25,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### **Copy Library to Personal Deck**
```
POST /api/student/flashcards/copy-deck/1
```

**Response:**
```json
{
  "status": "success",
  "message": "Successfully copied library \"Medgap Medical Basics\" with 25 flashcards",
  "data": {
    "new_deck_id": 456,
    "copied_cards": 25,
    "source_library": {
      "library_id": 1,
      "library_name": "Medgap Medical Basics",
      "total_cards": 25
    },
    "new_deck": {
      "deck_id": 456,
      "deck_title": "My Medgap Deck",
      "deck_description": "Personal copy of medgap library for study"
    }
  }
}
```

## 🔧 **Test Script Usage**

1. **Update the JWT token** in `copy_medgap_deck.js`:
   ```javascript
   const studentToken = 'YOUR_ACTUAL_JWT_TOKEN_HERE';
   ```

2. **Run the script**:
   ```bash
   node copy_medgap_deck.js
   ```

3. **Or copy by specific library ID**:
   ```javascript
   copyLibraryById(123); // Replace 123 with actual library ID
   ```

## 🎯 **What Happens When You Copy**

1. **Creates New Personal Deck**: A new deck is created in your `student_deck` table
2. **Copies All Cards**: All flashcards from the library are copied to `student_flash_cards`
3. **Preserves Metadata**: Original library and flashcard IDs are stored in tags
4. **Resets Progress**: All copied cards start with 'not_seen' status for fresh learning
5. **Maintains Order**: Cards are copied in their original order

## 📊 **Database Changes**

- **Source**: `flashcard_libraries` + `flashcards` tables
- **Target**: `student_deck` + `student_flash_cards` tables
- **Tags Field**: Contains source tracking information

## 🚨 **Troubleshooting**

### **Connection Error Fixed**
- Reduced MySQL connection limit to prevent "too many connections" error
- Added connection timeouts for better error handling

### **Authentication Required**
- All endpoints require valid student JWT token
- Token must be included in Authorization header: `Bearer <token>`

### **Library Not Found**
- Make sure the library exists and is active
- Check library ID is correct
- Verify library has flashcards

## 📝 **Example Usage**

```javascript
// 1. Find medgap library
const libraries = await axios.get('/api/student/flashcards/libraries?search=medgap');

// 2. Copy the library
const result = await axios.post(`/api/student/flashcards/copy-deck/${libraryId}`, {
  deck_title: 'My Medgap Study Deck',
  deck_description: 'Personal copy for exam preparation'
});

console.log(`Copied ${result.data.copied_cards} cards to deck ${result.data.new_deck_id}`);
```

## ✅ **Ready to Use**

The system is now ready to copy medgap libraries to your personal deck! Just:

1. Get your student JWT token
2. Find the medgap library ID
3. Use the copy endpoint
4. Start studying with your personal deck!
