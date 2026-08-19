const avatarColors = ["#4056a1", "#9b4dca", "#c73d25", "#21885d", "#a26b19", "#176b87"];

export function initialsForHandle(handle: string) {
  return handle.slice(0, 2).toUpperCase();
}

export function avatarColorForHandle(handle: string) {
  const value = Array.from(handle.toLowerCase()).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

  return avatarColors[value % avatarColors.length];
}
