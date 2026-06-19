import { describe, expect, it } from "vitest";
import { chooseAvailableName } from "../../src/main/core/fileNaming";

describe("file naming", () => {
  it("returns the requested name when it is available", () => {
    const existingNames = new Set(["Other.jpg"]);

    expect(chooseAvailableName("Photo.jpg", existingNames)).toBe("Photo.jpg");
  });

  it("adds a numbered suffix before the extension when the requested name conflicts", () => {
    const existingNames = new Set(["Photo.jpg"]);

    expect(chooseAvailableName("Photo.jpg", existingNames)).toBe("Photo (1).jpg");
  });

  it("detects conflicts case-insensitively while preserving the requested casing", () => {
    const existingNames = new Set(["Photo.jpg"]);

    expect(chooseAvailableName("photo.jpg", existingNames)).toBe("photo (1).jpg");
  });

  it("increments the suffix until a free name is found", () => {
    const existingNames = new Set(["Photo.jpg", "photo (1).jpg", "Photo (2).jpg"]);

    expect(chooseAvailableName("Photo.jpg", existingNames)).toBe("Photo (3).jpg");
  });

  it("adds a suffix to names without an extension", () => {
    const existingNames = new Set(["Photo", "Photo (1)"]);

    expect(chooseAvailableName("Photo", existingNames)).toBe("Photo (2)");
  });

  it("uses the final dot as the extension boundary for multi-dot names", () => {
    const existingNames = new Set(["archive.tar.gz"]);

    expect(chooseAvailableName("archive.tar.gz", existingNames)).toBe("archive.tar (1).gz");
  });

  it("throws when the attempt limit is exhausted", () => {
    const existingNames = new Set(["PHOTO.JPG"]);

    for (let attempt = 1; attempt <= 10_000; attempt += 1) {
      existingNames.add(`PHOTO (${attempt}).JPG`);
    }

    expect(() => chooseAvailableName("Photo.jpg", existingNames)).toThrow(
      "Unable to choose an available file name after 10000 attempts."
    );
  });
});
