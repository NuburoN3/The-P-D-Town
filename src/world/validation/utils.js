export function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function isInteger(value) {
  return Number.isInteger(value);
}

export function ensureMapShape(errors, map, width, height, path) {
  if (!Array.isArray(map)) {
    errors.push(`${path} must return an array of rows.`);
    return;
  }

  if (map.length !== height) {
    errors.push(`${path} row count mismatch. Expected ${height}, got ${map.length}.`);
  }

  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    if (!Array.isArray(row)) {
      errors.push(`${path}[${y}] must be an array.`);
      continue;
    }

    if (row.length !== width) {
      errors.push(`${path}[${y}] column count mismatch. Expected ${width}, got ${row.length}.`);
    }

    for (let x = 0; x < row.length; x++) {
      if (typeof row[x] !== "number") {
        errors.push(`${path}[${y}][${x}] must be a number tile id.`);
      }
    }
  }
}

export function inBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}
