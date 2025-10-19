const fs = require("fs");

/**
 * Parse questions from .txt file content or buffer
 * Expected format:
 * Question Text: What is the capital of France? | Type: multiple_choice | Options: A) Paris B) London C) Berlin D) Madrid | Correct Option: A | Difficulty: easy | Tags: geography, Europe | Keywords: capital, city, France | Hint: Think about the most famous city in France | Help: This is a basic geography question about European capitals
 */
function parseQuestionsFromText(filePathOrBuffer) {
  try {
    let content;
    
    // Handle both file path (local) and buffer (serverless)
    if (Buffer.isBuffer(filePathOrBuffer)) {
      content = filePathOrBuffer.toString('utf8');
    } else {
      content = fs.readFileSync(filePathOrBuffer, "utf8");
    }
    
    const lines = content.split("\n").filter(line => line.trim() !== "");
    
    const questions = [];
    const errors = [];
    
    lines.forEach((line, index) => {
      try {
        const question = parseQuestionLine(line.trim(), index + 1);
        if (question) {
          questions.push(question);
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
      questions,
      errors,
      totalLines: lines.length,
      successCount: questions.length,
      errorCount: errors.length
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

/**
 * Parse a single question line
 */
function parseQuestionLine(line, lineNumber) {
  if (!line || line.trim() === "") {
    return null;
  }
  
  // Split by pipe separator
  const parts = line.split("|").map(part => part.trim());
  
  if (parts.length < 3) {
    throw new Error(`Invalid format: Expected at least 3 parts separated by '|', got ${parts.length}`);
  }
  
  const question = {};
  
  parts.forEach(part => {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) {
      throw new Error(`Invalid part format: "${part}" - missing colon separator`);
    }
    
    const key = part.substring(0, colonIndex).trim().toLowerCase();
    const value = part.substring(colonIndex + 1).trim();
    
    switch (key) {
      case "question text":
        question.question_text = value;
        break;
      case "type":
        question.question_type = value.toLowerCase();
        break;
      case "options":
        question.options = parseOptions(value, question.question_type);
        break;
      case "correct option":
        question.correct_option = value;
        break;
      case "difficulty":
        question.difficulty_level = value.toLowerCase();
        break;
      case "tags":
        question.tags = parseTags(value);
        break;
      case "keywords":
        question.keywords = parseKeywords(value);
        break;
      case "hint":
        question.hint = value;
        break;
      case "help":
      case "help guidance":
        question.help_guidance = value;
        break;
      default:
        // Ignore unknown fields
        break;
    }
  });
  
  // Validate required fields
  if (!question.question_text) {
    throw new Error("Missing 'Question Text' field");
  }
  
  if (!question.question_type) {
    throw new Error("Missing 'Type' field");
  }
  
  if (!question.difficulty_level) {
    question.difficulty_level = "medium"; // Default difficulty
  }
  
  // Validate question type
  const validTypes = ["multiple_choice", "true_false", "essay"];
  if (!validTypes.includes(question.question_type)) {
    throw new Error(`Invalid question type: ${question.question_type}. Must be one of: ${validTypes.join(", ")}`);
  }
  
  // Validate difficulty
  const validDifficulties = ["easy", "medium", "hard"];
  if (!validDifficulties.includes(question.difficulty_level)) {
    throw new Error(`Invalid difficulty: ${question.difficulty_level}. Must be one of: ${validDifficulties.join(", ")}`);
  }
  
  // Set default tags if not provided
  if (!question.tags || question.tags.length === 0) {
    question.tags = ["imported"];
  }
  
  // Process options based on question type
  if (question.question_type === "multiple_choice" || question.question_type === "true_false") {
    if (!question.options || question.options.length === 0) {
      throw new Error(`Options are required for ${question.question_type} questions`);
    }
    
    // Mark correct option
    if (question.correct_option) {
      markCorrectOption(question.options, question.correct_option, question.question_type);
    }
  } else if (question.question_type === "essay") {
    // For essay questions, we don't need options
    delete question.options;
    delete question.correct_option;
  }
  
  // Set default values
  question.status = "draft";
  question.points = 1;
  question.keywords = [];
  question.hint = null;
  question.help_guidance = null;
  question.model_answer = null;
  
  return question;
}

/**
 * Parse options string into array of option objects
 */
function parseOptions(optionsString, questionType) {
  if (!optionsString || optionsString.trim() === "" || optionsString.toLowerCase() === "n/a") {
    return [];
  }
  
  const options = [];
  
  if (questionType === "true_false") {
    // For true/false, options are typically "True False" or "True, False"
    const parts = optionsString.split(/[,\s]+/).filter(part => part.trim() !== "");
    parts.forEach((part, index) => {
      options.push({
        option_text: part.trim(),
        is_correct: false, // Will be set later based on correct_option
        explanation: null,
        video_explanation_url: null,
        option_order: index + 1
      });
    });
  } else {
    // For multiple choice, options are typically "A) Option1 B) Option2 C) Option3 D) Option4"
    const parts = optionsString.split(/(?=[A-Z]\))/).filter(part => part.trim() !== "");
    parts.forEach((part, index) => {
      const cleanPart = part.trim();
      if (cleanPart) {
        options.push({
          option_text: cleanPart,
          is_correct: false, // Will be set later based on correct_option
          explanation: null,
          video_explanation_url: null,
          option_order: index + 1
        });
      }
    });
  }
  
  return options;
}

/**
 * Parse tags string into array
 */
function parseTags(tagsString) {
  if (!tagsString || tagsString.trim() === "") {
    return [];
  }
  
  return tagsString.split(",").map(tag => tag.trim()).filter(tag => tag !== "");
}

/**
 * Parse keywords string into array
 */
function parseKeywords(keywordsString) {
  if (!keywordsString || keywordsString.trim() === "") {
    return [];
  }
  
  return keywordsString.split(",").map(keyword => keyword.trim()).filter(keyword => keyword !== "");
}

/**
 * Mark the correct option based on correct_option value
 */
function markCorrectOption(options, correctOption, questionType) {
  if (!options || options.length === 0) {
    return;
  }
  
  const correctValue = correctOption.trim().toLowerCase();
  
  if (questionType === "true_false") {
    // For true/false, correct_option is typically "True" or "False"
    options.forEach(option => {
      option.is_correct = option.option_text.toLowerCase() === correctValue;
    });
  } else {
    // For multiple choice, correct_option is typically "A", "B", "C", "D", etc.
    options.forEach(option => {
      const optionLetter = option.option_text.charAt(0).toLowerCase();
      option.is_correct = optionLetter === correctValue;
    });
  }
}

module.exports = {
  parseQuestionsFromText,
  parseQuestionLine,
  parseOptions,
  parseTags,
  parseKeywords,
  markCorrectOption
};
