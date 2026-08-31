import exifr from "exifr/dist/full.umd.js";

export const getCityFromCoords = async (lat, lon) => {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Geocoding error (${response.status})`);
      return "Location Unavailable";
    }

    const data = await response.json();

    // Extracts City (or Locality) and State/Region code
    const city = data.city || data.locality || "";
    const state =
      data.principalSubdivisionCode || data.principalSubdivision || "";

    const locationParts = [city, state].filter(Boolean);

    return locationParts.length > 0
      ? locationParts.join(", ")
      : "Unknown Location";
  } catch (err) {
    console.error("Geocoding failed:", err);
    return "Unknown Location";
  }
};

export const processPhotoMetadata = async (file) => {
  try {
    if (!file) return "Taken on Unknown Date in Unknown Location.";

    // 1. Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // 2. Parse EXIF with explicit parsing parameters
    const exifData = await exifr.parse(arrayBuffer, {
      tiff: true,
      xmp: true,
      gps: true,
      heic: true,
      reviveValues: true,
      pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
    });

    if (!exifData) {
      console.warn("⚠️ No EXIF data payload found in HEIC file.");
      return "Taken on Unknown Date in Unknown Location.";
    }

    const rawDate = exifData.DateTimeOriginal || exifData.CreateDate;
    let formattedDate = "Unknown Date";

    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        formattedDate = parsedDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }

    let location = "Unknown Location";
    if (
      typeof exifData.latitude === "number" &&
      typeof exifData.longitude === "number"
    ) {
      location = await getCityFromCoords(exifData.latitude, exifData.longitude);
    }

    return `Taken on ${formattedDate} in ${location}.`;
  } catch (err) {
    console.warn(
      "⚠️ Could not extract EXIF metadata from this file:",
      err.message,
    );
    return "Taken on Unknown Date in Unknown Location.";
  }
};
