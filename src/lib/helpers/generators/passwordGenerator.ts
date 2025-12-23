const generatePassword = (name?: string, surname?: string): string => {
  const length = Math.floor(Math.random() * (20 - 8 + 1)) + 8; // /ngitud aleatoria entre 8 y 20 caracteres
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; // / Caracteres permitidosnst replacements: { [key: string]: string[] } = {
    // // Reemplazos de letras por caracteres especiales
    a: ["@"],
    e: ["3"],
    i: ["1"],
    o: ["0"],
    s: ["$"],
  };
  let comnedString = "";

  if (name && surname) {
    const useBoth = Math.random() < 0.5; // / Deterna si se usan ambos nombres o solo uno
    if (useBoth) {
      const nameLength = Math.floor(Math.random() * (name.length - 3)) + 3; // /ngitud aleatoria del fragmento del nombre
      const surnameLength =
        Math.floor(Math.random() * (surname.length - 3)) + 3; // /ngitud aleatoria del fragmento del apellido
      const randomNameStart = Math.floor(
        Math.random() * (name.length - nameLength)
      ); // /ndice aleatorio de inicio del fragmento del nombre
      const randomSurnameStart = Math.floor(
        Math.random() * (surname.length - surnameLength)
      ); // /ndice aleatorio de inicio del fragmento del apellido
      combinedString =
        name.substring(randomNameStart, randomNameStart + nameLength) +
        surname.substring(
          randomSurnameStart,
          randomSurnameStart + surnameLength
        ); // / Fragnto aleatorio del nombre y apellido
    } else {
      combinedString = Math.random() < 0.5 ? name : surname; // / Usa solo enombre o el apellido aleatoriamente
    }
  } else if (name) {
    combinedString = name; // / Usa solo enombre si se proporciona
  } else if (surname) {
    combinedString = surname; // / Usa solo el apellido si se proporcna
  }

  let password = "";

  for (let i = 0; i < length; i++) {
    if (i < combinedString.length) {
      // // Usar caracteres denombre o apellido si se proporciona uno solo
      const char = combinedString[i];
      const possibleReplacements = replacements[char.toLowerCase()] || [char]; // / Reemplazos posibles para el carácternst shouldReplace = Math.random() < 0.5; // / Deterna aleatoriamente si se debe reemplazar el carácter
      if (shouldReplace) {
        const randomReplacementIndex = Math.floor(
          Math.random() * possibleReplacements.length
        ); // /ndice aleatorio para seleccionar el reemplazo
        password += possibleReplacements[randomReplacementIndex]; // / Caracter tnsformado aleatoriamente
      } else {
        password += char; // /ntener el carácter original
      }
    } else {
      // // Usar caracteres aleatorios sno se proporciona nombre ni apellido o si se agotan los caracteres del nombre y apellido
      const randomIndex = Math.floor(Math.random() * chars.length);
      password += chars[randomIndex];
    }
  }

  return password;
};

export default generatePassword;
