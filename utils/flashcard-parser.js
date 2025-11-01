const fs = require("fs");

/**
 * Parse flashcards from .txt file content
 * Expected format:
 * Front Text: What is the capital of France? | Back Text: Paris | Difficulty: easy | Card Order: 1 | Status: draft
 * 
 * Optional fields: Difficulty (easy|medium|hard), Card Order (integer), Status (draft|active|inactive)
 * Lines starting with # are treated as comments and ignored
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

    // Split all lines and track original line numbers
    const allLines = content.split("\n");
    const flashcards = [];
    const errors = [];

    allLines.forEach((line, originalLineNumber) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comment lines (starting with #)
      if (trimmedLine === "" || trimmedLine.startsWith("#")) {
        return;
      }

      try {
        const flashcard = parseFlashcardLine(trimmedLine, originalLineNumber + 1);
        if (flashcard) {
          flashcards.push(flashcard);
        }
      } catch (error) {
        errors.push({
          line: originalLineNumber + 1,
          content: trimmedLine,
          error: error.message
        });
      }
    });

    const totalProcessedLines = allLines.filter(line => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("#");
    }).length;

    return {
      flashcards,
      errors,
      totalLines: totalProcessedLines,
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
        const difficultyValue = value.toLowerCase();
        if (["easy", "medium", "hard"].includes(difficultyValue)) {
          flashcard.difficulty_level = difficultyValue;
        } else {
          throw new Error(`Invalid difficulty level: ${value}. Must be one of: easy, medium, hard`);
        }
        break;
      case "card order":
        const orderValue = parseInt(value);
        if (!isNaN(orderValue) && orderValue > 0) {
          flashcard.card_order = orderValue;
        } else {
          throw new Error(`Invalid card order: ${value}. Must be a positive integer`);
        }
        break;
      case "status":
        const statusValue = value.toLowerCase();
        if (["draft", "active", "inactive"].includes(statusValue)) {
          flashcard.status = statusValue;
        } else {
          throw new Error(`Invalid status: ${value}. Must be one of: draft, active, inactive`);
        }
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
