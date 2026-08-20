import exifr from "exifr";

export const getCityFromCoords = async (lat, lon) => {
  try {
    // Adding zoom level (10-14 gives clear city/town boundaries)
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
    console.log("DEBUG: Full Nominatim Response:", data);

    const a = data.address;
    if (!a) return "Area Unknown";

    // Standardized locality check
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
    console.log(
      "DEBUG: Starting metadata extraction for file:",
      file?.name,
      file?.type,
    );

    if (!file) {
      console.warn("DEBUG: No file provided to processPhotoMetadata");
      return "Taken on Unknown Date in Unknown Location.";
    }

    // Force exifr to parse GPS explicitly, including TIFF and HEIC buffers
    const exifData = await exifr.parse(file, {
      tiff: true,
      xmp: true,
      gps: true,
      reviveValues: true,
      pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
    });

    console.log("DEBUG: Raw EXIF Data object extracted:", exifData);

    // Fallback for date tags (some phones use CreateDate instead of DateTimeOriginal)
    const rawDate = exifData?.DateTimeOriginal || exifData?.CreateDate;

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

    console.log("DEBUG: Formatted Date:", formattedDate);

    let location = "Unknown Location";

    // Validate coordinates
    if (
      typeof exifData?.latitude === "number" &&
      typeof exifData?.longitude === "number"
    ) {
      console.log(
        `DEBUG: Valid GPS found: (${exifData.latitude}, ${exifData.longitude})`,
      );
      location = await getCityFromCoords(exifData.latitude, exifData.longitude);
    } else {
      console.warn(
        "DEBUG: GPS coordinates absent or stripped from this photo.",
      );
    }

    const result = `Taken on ${formattedDate} in ${location}.`;
    console.log("DEBUG: Final Result String:", result);
    return result;
  } catch (err) {
    console.error("DEBUG: Critical error in processPhotoMetadata:", err);
    return "Taken on Unknown Date in Unknown Location.";
  }
};
