const fs = require("fs");

/**
 * Parse flashcards from .txt file content
 * Expected format:
 * Front Text: What is the capital of France? | Back Text: Paris | Difficulty: easy | Tags: geography, Europe | Keywords: capital, city, France | Hint: Think about the most famous city in France | Help: This is a basic geography question about European capitals
 */
function parseFlashcardsFromText(filePathOrBuffer) {
  try {
    let content;

    // Handle both file path (local) and buffer (serverless)
    if (Buffer.isBuffer(filePathOrBuffer)) {
      content = filePathOrBuffer.toString('utf8');
    } else {
      content = fs.readFileSync(filePathOrBuffer, "utf8");
    }

    const lines = content.split("\n").filter(line => line.trim() !== "");

    const flashcards = [];
    const errors = [];

    lines.forEach((line, index) => {
      try {
        const flashcard = parseFlashcardLine(line.trim(), index + 1);
        if (flashcard) {
          flashcards.push(flashcard);
        }
      } catch (error) {
        errors.push({
          line: index + 1,
          content: line.trim(),
          error: error.message
        });
      }
    });

    return {
      flashcards,
      errors,
      totalLines: lines.length,
      successCount: flashcards.length,
      errorCount: errors.length
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

function parseFlashcardLine(line, lineNumber) {
  if (!line || line.trim() === "") {
    return null;
  }

  const flashcard = {
    front_text: "",
    back_text: "",
    difficulty_level: "medium",
    card_order: 1,
    status: "draft"
  };

  // Split by | and parse each field
  const fields = line.split("|").map(field => field.trim());

  fields.forEach(field => {
    const colonIndex = field.indexOf(":");
    if (colonIndex === -1) return;

    const key = field.substring(0, colonIndex).trim().toLowerCase();
    const value = field.substring(colonIndex + 1).trim();

    switch (key) {
      case "front text":
        flashcard.front_text = value;
        break;
      case "back text":
        flashcard.back_text = value;
        break;
      case "difficulty":
        flashcard.difficulty_level = value.toLowerCase();
        break;
      case "card order":
        flashcard.card_order = parseInt(value) || 1;
        break;
      case "status":
        flashcard.status = value.toLowerCase();
        break;
      case "tags":
      case "keywords":
      case "hint":
      case "help":
      case "help guidance":
        // Ignore these fields as they don't exist in the current database schema
        break;
      default:
        // Ignore unknown fields
        break;
    }
  });

  // Validate required fields
  if (!flashcard.front_text || !flashcard.back_text) {
    throw new Error(`Missing required fields: front_text and back_text are required`);
  }

  return flashcard;
}

function parseTags(tagsString) {
  if (!tagsString || tagsString.trim() === "") {
    return [];
  }

  return tagsString.split(",").map(tag => tag.trim()).filter(tag => tag !== "");
}

function parseKeywords(keywordsString) {
  if (!keywordsString || keywordsString.trim() === "") {
    return [];
  }

  return keywordsString.split(",").map(keyword => keyword.trim()).filter(keyword => keyword !== "");
}

module.exports = {
  parseFlashcardsFromText
};
