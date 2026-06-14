const MAX_PROFILE_PICTURE_LENGTH = 500_000;

export function validateProfilePicture(
  value: string | null | undefined,
): string | null {
  if (value == null || value.trim() === "") return null;

  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.length > 2048) {
      throw new Error("Profile picture URL is too long");
    }
    return trimmed;
  }

  if (trimmed.startsWith("data:image/")) {
    if (trimmed.length > MAX_PROFILE_PICTURE_LENGTH) {
      throw new Error("Profile picture file is too large (max ~350KB)");
    }
    return trimmed;
  }

  throw new Error("Profile picture must be a valid image URL or uploaded image");
}

export function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
