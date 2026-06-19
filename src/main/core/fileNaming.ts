const MAX_NAME_ATTEMPTS = 10_000;

export function chooseAvailableName(requestedName: string, existingNames: Set<string>): string {
  const normalizedExistingNames = new Set([...existingNames].map(normalizeName));

  if (!normalizedExistingNames.has(normalizeName(requestedName))) {
    return requestedName;
  }

  const { baseName, extension } = splitName(requestedName);

  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
    const candidate = `${baseName} (${attempt})${extension}`;

    if (!normalizedExistingNames.has(normalizeName(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Unable to choose an available file name after ${MAX_NAME_ATTEMPTS} attempts.`);
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}

function splitName(name: string): { baseName: string; extension: string } {
  const extensionStart = name.lastIndexOf(".");

  if (extensionStart <= 0) {
    return { baseName: name, extension: "" };
  }

  return {
    baseName: name.slice(0, extensionStart),
    extension: name.slice(extensionStart)
  };
}
