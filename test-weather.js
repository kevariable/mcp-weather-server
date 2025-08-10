// Simple test script for weather API
async function testWeather() {
    try {
        const city = "Pekanbaru";
        
        // Test geocoding
        const geoResponse = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`
        );
        const geoData = await geoResponse.json();
        
        if (!geoData || geoData.results.length === 0) {
            console.log(`No results found for ${city}`);
            return;
        }
        
        // Test weather data
        const { latitude, longitude } = geoData.results[0];
        const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&weather_code&forecast_days=1`
        );
        const weatherData = await weatherResponse.json();
        
        console.log(`Weather for ${city}:`, JSON.stringify(weatherData, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testWeather();
