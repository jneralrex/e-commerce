const axios = require("axios");

const getCoordinates = async (address) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const { lat, lng } = response.data.results[0].geometry.location;
    if (!response.data.results || response.data.results.length === 0) {
        throw new CustomError(400, "No coordinates found for the given address", "GeocodingError");
      }
    return { lat, lng };
  } catch (err) {
    console.error("Error fetching coordinates", err);
    return null;
  }
};

module.exports = { getCoordinates };
