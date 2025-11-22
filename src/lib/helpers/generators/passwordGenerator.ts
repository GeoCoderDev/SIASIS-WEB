const generatePassword = (name?: string, surname?: string): string => {
  const length = Math.floor(Math.random() * (20 - 8 + 1)) + 8; // Random length between 8 and 20 characters
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; // Allowed characters
  const replacements: { [key: string]: string[] } = {
    // Letter replacements with special characters
    a: ["@"],
    e: ["3"],
    i: ["1"],
    o: ["0"],
    s: ["$"],
  };
  let combinedString = "";

  if (name && surname) {
    const useBoth = Math.random() < 0.5; // Determines if both names are used or just one
    if (useBoth) {
      const nameLength = Math.floor(Math.random() * (name.length - 3)) + 3; // Random length of the name fragment
      const surnameLength =
        Math.floor(Math.random() * (surname.length - 3)) + 3; // Random length of the surname fragment
      const randomNameStart = Math.floor(
        Math.random() * (name.length - nameLength)
      ); // Random start index of the name fragment
      const randomSurnameStart = Math.floor(
        Math.random() * (surname.length - surnameLength)
      ); // Random start index of the surname fragment
      combinedString =
        name.substring(randomNameStart, randomNameStart + nameLength) +
        surname.substring(
          randomSurnameStart,
          randomSurnameStart + surnameLength
        ); // Random fragment of name and surname
    } else {
      combinedString = Math.random() < 0.5 ? name : surname; // Randomly use only the name or surname
    }
  } else if (name) {
    combinedString = name; // Use only the name if provided
  } else if (surname) {
    combinedString = surname; // Use only the surname if provided
  }

  let password = "";

  for (let i = 0; i < length; i++) {
    if (i < combinedString.length) {
      // Use characters from the name or surname if only one is provided
      const char = combinedString[i];
      const possibleReplacements = replacements[char.toLowerCase()] || [char]; // Possible replacements for the character
      const shouldReplace = Math.random() < 0.5; // Randomly determines if the character should be replaced
      if (shouldReplace) {
        const randomReplacementIndex = Math.floor(
          Math.random() * possibleReplacements.length
        ); // Random index to select the replacement
        password += possibleReplacements[randomReplacementIndex]; // Randomly transformed character
      } else {
        password += char; // Keep the original character
      }
    } else {
      // Use random characters if no name or surname is provided or if the name and surname characters are exhausted
      const randomIndex = Math.floor(Math.random() * chars.length);
      password += chars[randomIndex];
    }
  }

  return password;
};

export default generatePassword;
