# Flashcards Upload API Documentation

## Overview
This API endpoint allows you to upload flashcards from a `.txt` file to a flashcard library. The endpoint supports bulk upload with optimized batch processing and serverless environment compatibility.

## Endpoint
```
POST /api/flashcards/upload
```

## Request Format

### Headers
```
Content-Type: multipart/form-data
```

### Form Data
- `flashcardsFile` (required): The `.txt` file containing flashcards
- `library_id` (optional): ID of the flashcard library to add flashcards to
- `topic_id` (optional): ID of the topic to associate flashcards with

### File Format
Each line in the `.txt` file should contain one flashcard with the following format:

```
Front Text: [Question or prompt] | Back Text: [Answer or response] | Difficulty: [easy/medium/hard] | Tags: [tag1, tag2, tag3] | Keywords: [keyword1, keyword2] | Hint: [Optional hint] | Help: [Optional help text] | Card Order: [Optional order number] | Status: [Optional status]
```

### Required Fields
- `Front Text`: The question or prompt for the flashcard
- `Back Text`: The answer or response for the flashcard

### Optional Fields
- `Difficulty`: easy, medium, or hard (default: medium)
- `Tags`: Comma-separated list of tags
- `Keywords`: Comma-separated list of keywords
- `Hint`: Additional hint for the flashcard
- `Help`: Help text or guidance
- `Card Order`: Order number for the flashcard (default: 1)
- `Status`: draft, active, or inactive (default: draft)

## Example File Content
```
Front Text: What is the normal range for adult blood pressure? | Back Text: 120/80 mmHg | Difficulty: easy | Tags: cardiology, vital signs | Keywords: blood pressure, hypertension, normal range, mmHg | Hint: Consider the standard reference values used in clinical practice | Help: This flashcard tests knowledge of normal vital sign parameters

Front Text: What is the primary function of insulin? | Back Text: To regulate blood glucose levels by facilitating glucose uptake into cells | Difficulty: medium | Tags: endocrinology, diabetes | Keywords: insulin, glucose, diabetes, metabolism | Hint: Think about what happens when blood sugar levels are high | Help: Understanding insulin's role is crucial for diabetes management
```

## Response Format

### Success Response (201 Created)
```json
{
  "status": "success",
  "message": "File processed successfully. 20 flashcards created, 0 failed.",
  "data": {
    "message": "File processed successfully. 20 flashcards created, 0 failed.",
    "performance_metrics": {
      "total_processing_time_ms": 1250,
      "parsing_time_ms": 45,
      "database_time_ms": 1200,
      "flashcards_per_second": 16,
      "environment": "local"
    },
    "file_info": {
      "original_name": "medical-flashcards.txt",
      "file_size": 2048,
      "uploaded_at": "2024-01-15T10:30:00.000Z",
      "processing_method": "disk"
    },
    "library_info": {
      "library_id": 1,
      "applied_to_all_flashcards": true
    },
    "topic_info": {
      "topic_id": 5,
      "applied_to_all_flashcards": true
    },
    "parsing_results": {
      "total_lines": 20,
      "parsing_errors": [],
      "parsing_error_count": 0
    },
    "creation_results": {
      "total_processed": 20,
      "successful": [
        {
          "index": 1,
          "flashcard_id": 101,
          "front_text": "What is the normal range for adult blood pressure?",
          "back_text": "120/80 mmHg"
        }
      ],
      "failed": [],
      "success_count": 20,
      "failure_count": 0
    }
  },
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  },
  "error": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response (400 Bad Request)
```json
{
  "status": "error",
  "message": "No file uploaded. Please upload a .txt file.",
  "data": null,
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  },
  "error": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Usage Examples

### cURL
```bash
curl -X POST \
  http://localhost:3000/api/flashcards/upload \
  -F "flashcardsFile=@medical-flashcards.txt" \
  -F "library_id=1" \
  -F "topic_id=5"
```

### JavaScript (Fetch)
```javascript
const formData = new FormData();
formData.append('flashcardsFile', fileInput.files[0]);
formData.append('library_id', '1');
formData.append('topic_id', '5');

fetch('/api/flashcards/upload', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

### Postman
1. Set method to POST
2. Set URL to `/api/flashcards/upload`
3. Go to Body tab, select "form-data"
4. Add key "flashcardsFile" with type "File" and select your .txt file
5. Add key "library_id" with value "1" (optional)
6. Add key "topic_id" with value "5" (optional)

## Features

### Performance Optimization
- **Batch Processing**: Processes flashcards in batches of 50 for optimal performance
- **Database Transactions**: Uses transactions to ensure data integrity
- **Parallel Processing**: Processes batches in parallel for faster uploads

### Serverless Compatibility
- **Memory Storage**: Uses memory storage for serverless environments (Vercel, AWS Lambda)
- **Disk Storage**: Uses disk storage for local development
- **Automatic Detection**: Automatically detects serverless environment

### Error Handling
- **Detailed Error Reporting**: Provides specific error messages for parsing failures
- **Partial Success**: Continues processing even if some flashcards fail
- **File Cleanup**: Automatically cleans up uploaded files after processing

### Data Validation
- **Required Fields**: Validates that front_text and back_text are present
- **Field Formatting**: Automatically formats difficulty levels and status values
- **JSON Serialization**: Properly serializes arrays (tags, keywords) to JSON

## File Size Limits
- Maximum file size: 10MB
- Maximum fields: 10
- Field size limit: 1MB
- Field name size limit: 100 characters

## Supported File Types
- `.txt` files with `text/plain` MIME type
- `.txt` files with `application/octet-stream` MIME type (fallback)

## Notes
- The API automatically assigns `library_id` and `topic_id` to all flashcards if provided in form data
- Flashcards are created with `created_by` and `updated_by` set to the current user
- The system supports both local development and serverless deployment environments
- Debug logging is included for troubleshooting parsing and database operations
