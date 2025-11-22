export default function isSQLInjection(cadena: string): boolean {
  // Common SQL injection patterns
  const patrones: RegExp[] = [
    /\b(SELECT|UPDATE|DELETE)\b/i, // Query keywords
    /\b(INSERT INTO|DROP TABLE|ALTER TABLE)\b/i, // Table modification keywords
    /\b(UNION\s+SELECT|SELECT\s+.*\s+FROM|INSERT\s+INTO.*\s+VALUES)\b/i, // Compound SQL statements
    /\b(AND\s+\d+\s*=\s*\d+|OR\s+\d+\s*=\s*\d+|HAVING\s+\d+\s*=\s*\d+)\b/i, // Logical comparison operators
  ];

  // Check if the string matches any SQL injection pattern
  for (const patron of patrones) {
    if (patron.test(cadena)) {
      return true; // SQL injection pattern found
    }
  }

  return false; // No SQL injection patterns found
}
