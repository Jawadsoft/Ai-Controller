/**
 * Smart search parser that extracts vehicle information from combined text
 * Examples: "Hyundai Palisade 2024 STK123" -> { make: "Hyundai", model: "Palisade", year: "2024", stock_number: "STK123" }
 */

interface ParsedVehicleInfo {
  make: string;
  model: string;
  year: string;
  stock_number: string;
  remainingText: string;
}

// Common vehicle makes for better detection
const COMMON_MAKES = [
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen',
  'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Lexus', 'Acura', 'Infiniti', 'Cadillac', 'Lincoln',
  'Jeep', 'Ram', 'GMC', 'Buick', 'Chrysler', 'Dodge', 'Volvo', 'Jaguar', 'Land Rover',
  'Porsche', 'Ferrari', 'Lamborghini', 'Maserati', 'Bentley', 'Rolls-Royce', 'Tesla',
  'Genesis', 'Alfa Romeo', 'Mitsubishi', 'Suzuki', 'Isuzu', 'Mitsubishi'
];

// Common stock number patterns
const STOCK_PATTERNS = [
  /^STK\d+/i,           // STK123, STK001
  /^ST\d+/i,            // ST123, ST001
  /^\d{3,6}$/,          // 123456, 12345
  /^[A-Z]{2,4}\d{3,6}$/i, // ABC123, ABCD1234
  /^[A-Z]\d{3,6}$/i,    // A123, A12345
];

export function parseVehicleSearch(searchText: string): ParsedVehicleInfo {
  if (!searchText || searchText.trim() === '') {
    return {
      make: '',
      model: '',
      year: '',
      stock_number: '',
      remainingText: ''
    };
  }

  const words = searchText.trim().split(/\s+/);
  const result: ParsedVehicleInfo = {
    make: '',
    model: '',
    year: '',
    stock_number: '',
    remainingText: ''
  };

  let remainingWords: string[] = [];
  let makeFound = false;
  let yearFound = false;
  let stockFound = false;

  // First pass: Find make
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const possibleMake = COMMON_MAKES.find(make => 
      make.toLowerCase() === word.toLowerCase() ||
      make.toLowerCase().includes(word.toLowerCase()) ||
      word.toLowerCase().includes(make.toLowerCase())
    );
    
    if (possibleMake && !makeFound) {
      result.make = possibleMake;
      makeFound = true;
      continue;
    }
    remainingWords.push(word);
  }

  // Second pass: Find year (4-digit number)
  const yearWords: string[] = [];
  for (let i = 0; i < remainingWords.length; i++) {
    const word = remainingWords[i];
    const yearMatch = word.match(/^(19|20)\d{2}$/); // 1900-2099
    
    if (yearMatch && !yearFound) {
      result.year = word;
      yearFound = true;
      continue;
    }
    yearWords.push(word);
  }

  // Third pass: Find stock number
  const finalWords: string[] = [];
  for (let i = 0; i < yearWords.length; i++) {
    const word = yearWords[i];
    const isStockNumber = STOCK_PATTERNS.some(pattern => pattern.test(word));
    
    if (isStockNumber && !stockFound) {
      result.stock_number = word.toUpperCase();
      stockFound = true;
      continue;
    }
    finalWords.push(word);
  }

  // Fourth pass: Model is what's left (usually the longest remaining word or combination)
  if (finalWords.length > 0) {
    // If we found a make, the model is likely the first remaining word
    if (makeFound) {
      result.model = finalWords[0];
      result.remainingText = finalWords.slice(1).join(' ');
    } else {
      // If no make found, first word might be make, second might be model
      if (finalWords.length >= 2) {
        result.make = finalWords[0];
        result.model = finalWords[1];
        result.remainingText = finalWords.slice(2).join(' ');
      } else {
        result.model = finalWords[0];
        result.remainingText = finalWords.slice(1).join(' ');
      }
    }
  }

  return result;
}

/**
 * Check if the search text looks like a combined vehicle description
 */
export function isCombinedVehicleSearch(searchText: string): boolean {
  if (!searchText || searchText.trim() === '') return false;
  
  const words = searchText.trim().split(/\s+/);
  if (words.length < 2) return false;
  
  // Check if it contains a year
  const hasYear = words.some(word => /^(19|20)\d{2}$/.test(word));
  
  // Check if it contains a make
  const hasMake = words.some(word => 
    COMMON_MAKES.some(make => 
      make.toLowerCase() === word.toLowerCase() ||
      make.toLowerCase().includes(word.toLowerCase()) ||
      word.toLowerCase().includes(make.toLowerCase())
    )
  );
  
  // Check if it contains a stock number
  const hasStock = words.some(word => 
    STOCK_PATTERNS.some(pattern => pattern.test(word))
  );
  
  return hasYear || hasMake || hasStock || words.length >= 3;
}
