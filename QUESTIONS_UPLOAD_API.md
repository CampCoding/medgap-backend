# Questions File Upload Endpoint

## Overview
This endpoint allows you to upload a `.txt` file containing multiple questions in a structured format and automatically create them in the database.

## Endpoint
```
POST /api/questions/upload
```

## Request Format
- **Content-Type**: `multipart/form-data`
- **File Field**: `questionsFile`
- **Optional Field**: `topic_id` (integer) - Topic ID to assign to all questions
- **File Type**: `.txt` files only
- **File Size Limit**: 5MB

## File Format
Each question should be on a separate line with the following format:

```
Question Text: [Your question here] | Type: [question_type] | Options: [options] | Correct Option: [correct_answer] | Difficulty: [difficulty_level] | Tags: [comma_separated_tags] | Keywords: [comma_separated_keywords] | Hint: [hint_text] | Help: [help_guidance_text]
```

### Supported Question Types
1. **multiple_choice**: Questions with multiple answer options
2. **true_false**: True/False questions
3. **essay**: Open-ended essay questions

### Difficulty Levels
- `easy`
- `medium` 
- `hard`

### Example File Content
```
Question Text: What is the capital of France? | Type: multiple_choice | Options: A) Paris B) London C) Berlin D) Madrid | Correct Option: A | Difficulty: easy | Tags: geography, Europe | Keywords: capital, city, France | Hint: Think about the most famous city in France | Help: This is a basic geography question about European capitals
Question Text: Is the Earth flat? | Type: true_false | Options: True False | Correct Option: False | Difficulty: medium | Tags: science, geography | Keywords: Earth, shape, astronomy | Hint: Consider what scientists have proven about Earth's shape | Help: This question tests basic knowledge of Earth's physical properties
Question Text: Explain photosynthesis | Type: essay | Options: N/A | Correct Option: N/A | Difficulty: hard | Tags: biology | Keywords: photosynthesis, plants, sunlight, energy | Hint: Think about how plants convert light energy into chemical energy | Help: Provide a detailed explanation of the photosynthesis process including reactants and products
```

## Response Format

### Success Response (201)
```json
{
  "status": "success",
  "message": "File processed successfully. 3 questions created, 0 failed.",
  "data": {
    "message": "File processed successfully. 3 questions created, 0 failed.",
    "file_info": {
      "original_name": "questions.txt",
      "file_size": 1024,
      "uploaded_at": "2024-01-15T10:30:00.000Z"
    },
    "topic_info": {
      "topic_id": 5,
      "applied_to_all_questions": true
    },
    "parsing_results": {
      "total_lines": 3,
      "parsing_errors": [],
      "parsing_error_count": 0
    },
    "creation_results": {
      "total_processed": 3,
      "successful": [
        {
          "index": 1,
          "question_id": 123,
          "question_text": "What is the capital of France?",
          "question_type": "multiple_choice"
        }
      ],
      "failed": [],
      "success_count": 3,
      "failure_count": 0
    }
  },
  "error": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response (400)
```json
{
  "status": "error",
  "message": "No file uploaded. Please upload a .txt file.",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": "No file uploaded. Please upload a .txt file."
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Field Requirements

### Required Fields
- **Question Text**: The actual question content
- **Type**: Question type (multiple_choice, true_false, essay)

### Optional Fields
- **Options**: Required for multiple_choice and true_false questions
- **Correct Option**: Required for multiple_choice and true_false questions
- **Difficulty**: Defaults to "medium" if not specified
- **Tags**: Defaults to ["imported"] if not specified
- **Keywords**: Comma-separated keywords for search and categorization
- **Hint**: Helpful hint text for students
- **Help**: Additional guidance or explanation text

### Field Details

#### Options Format
- **Multiple Choice**: `A) Option1 B) Option2 C) Option3 D) Option4`
- **True/False**: `True False` or `True, False`
- **Essay**: `N/A` (not applicable)

#### Correct Option Format
- **Multiple Choice**: Letter of correct option (A, B, C, D, etc.)
- **True/False**: `True` or `False`
- **Essay**: `N/A` (not applicable)

#### Tags Format
- Comma-separated list: `tag1, tag2, tag3`
- Spaces around commas are automatically trimmed

#### Keywords Format
- Comma-separated list: `keyword1, keyword2, keyword3`
- Spaces around commas are automatically trimmed
- Used for search functionality and categorization

#### Hint Format
- Single text field: `Think about the most famous city in France`
- Provides helpful guidance to students

#### Help Format
- Single text field: `This is a basic geography question about European capitals`
- Provides additional context or explanation

## Error Handling

The endpoint provides detailed error information for both parsing and creation phases:

### Parsing Errors
- Invalid format (missing required fields)
- Invalid question types
- Invalid difficulty levels
- Malformed options

### Creation Errors
- Database constraint violations
- Duplicate questions
- Invalid data types

## Usage Examples

### Using cURL
```bash
# Upload without topic_id
curl -X POST \
  http://localhost:3000/api/questions/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'questionsFile=@questions.txt'

# Upload with topic_id
curl -X POST \
  http://localhost:3000/api/questions/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'questionsFile=@questions.txt' \
  -F 'topic_id=5'
```

### Using JavaScript (FormData)
```javascript
const formData = new FormData();
formData.append('questionsFile', fileInput.files[0]);
formData.append('topic_id', '5'); // Optional: assign to topic ID 5

fetch('/api/questions/upload', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

### Using Postman
1. Set method to POST
2. Set URL to `/api/questions/upload`
3. Go to Body tab
4. Select "form-data"
5. Add key "questionsFile" with type "File" and select your .txt file
6. (Optional) Add key "topic_id" with type "Text" and enter the topic ID
7. Send request

## Notes
- Files are automatically cleaned up after processing
- Questions are created with "draft" status by default
- All questions are tagged with "imported" if no tags are specified
- The endpoint processes questions sequentially and reports individual failures
- Partial success is possible - some questions may be created even if others fail
