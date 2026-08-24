import exifr from "exifr";

export const getCityFromCoords = async (lat, lon) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "PhotoFlipApp/1.0 (contact@photoflip.app)",
      },
    });

    if (!response.ok) {
      console.error(
        `Nominatim API error (${response.status}):`,
        response.statusText,
      );
      return "Location Unavailable";
    }

    const data = await response.json();
    const a = data.address;
    if (!a) return "Area Unknown";

    return (
      a.city ||
      a.town ||
      a.municipality ||
      a.village ||
      a.suburb ||
      a.neighbourhood ||
      a.county ||
      a.state ||
      "Unknown Location"
    );
  } catch (err) {
    console.error("Geocoding failed:", err);
    return "Unknown Location";
  }
};

export const processPhotoMetadata = async (file) => {
  try {
    if (!file) return "Taken on Unknown Date in Unknown Location.";

    // Skip formats exifr can't process
    const unsupportedTypes = ["image/svg+xml", "image/gif"];
    if (unsupportedTypes.includes(file.type)) {
      console.warn(
        "⚠️ Skipping EXIF extraction for unsupported file type:",
        file.type,
      );
      return "Taken on Unknown Date in Unknown Location.";
    }

    // Convert file to ArrayBuffer for maximum exifr compatibility
    const arrayBuffer = await file.arrayBuffer();

    const exifData = await exifr.parse(arrayBuffer, {
      tiff: true,
      xmp: true,
      gps: true,
      heic: true,
      reviveValues: true,
      pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
    });

    if (!exifData) {
      console.warn("⚠️ No EXIF data payload found in file.");
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
