const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3000; // Use port from .env or default to 3000

// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse URL-encoded bodies (for form data) and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// District coordinates mapping for Odisha
const districtCoordinates = {
    'Angul': { lat: 20.8409, lon: 85.1012 },
    'Balangir': { lat: 20.7079, lon: 83.4886 },
    'Balasore': { lat: 21.4942, lon: 86.9317 },
    'Bargarh': { lat: 21.3333, lon: 83.6167 },
    'Bhadrak': { lat: 21.0545, lon: 86.5156 },
    'Cuttack': { lat: 20.4625, lon: 85.8830 },
    'Debagarh': { lat: 21.5333, lon: 84.7333 },
    'Dhenkanal': { lat: 20.6629, lon: 85.5963 },
    'Gajapati': { lat: 19.3667, lon: 84.7833 },
    'Ganjam': { lat: 19.3870, lon: 85.1787 },
    'Jagatsinghpur': { lat: 20.2667, lon: 86.1667 },
    'Jajpur': { lat: 20.8486, lon: 86.3373 },
    'Jharsuguda': { lat: 21.8504, lon: 84.0332 },
    'Kalahandi': { lat: 19.9133, lon: 83.1641 },
    'Kandhamal': { lat: 20.3670, lon: 84.2330 },
    'Kendrapara': { lat: 20.5021, lon: 86.4124 },
    'Keonjhar': { lat: 21.6333, lon: 85.6000 },
    'Khordha': { lat: 20.1820, lon: 85.6160 },
    'Koraput': { lat: 18.8116, lon: 82.7102 },
    'Malkangiri': { lat: 18.3500, lon: 81.9000 },
    'Mayurbhanj': { lat: 21.9297, lon: 86.7610 },
    'Nabarangpur': { lat: 19.2333, lon: 82.5333 },
    'Nayagarh': { lat: 20.1288, lon: 85.0962 },
    'Nuapada': { lat: 20.7167, lon: 82.7167 },
    'Puri': { lat: 19.8134, lon: 85.8315 },
    'Rayagada': { lat: 19.1667, lon: 83.4167 },
    'Sambalpur': { lat: 21.4667, lon: 83.9833 },
    'Sonepur': { lat: 20.8333, lon: 83.9167 },
    'Sundergarh': { lat: 22.1167, lon: 84.0333 }
};

// Route for the root URL, serves index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for input.html
app.get('/input.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'input.html'));
});

// Route for output.html
app.get('/output.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'output.html'));
});

// API endpoint to fetch weather data
app.post('/api/weather', async (req, res) => {
    try {
        const { district } = req.body;

        if (!district || !districtCoordinates[district]) {
            return res.status(400).json({
                error: 'Invalid district selected. Please choose a valid district from the list.'
            });
        }

        const { lat, lon } = districtCoordinates[district];
        const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

        if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'your_openweather_api_key_here') {
            return res.status(500).json({
                error: 'OpenWeather API key not configured. Please add your API key to the .env file.'
            });
        }

        try {
            // OpenWeatherMap's free tier provides 5-day / 3-hour forecast data.
            // We will process this to get daily summaries.
            const weatherResponse = await axios.get(
                `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
            );

            // Process the 3-hour forecast data into daily summaries
            const dailyForecasts = processWeatherData(weatherResponse.data);

            res.json({
                district,
                forecasts: dailyForecasts
            });

        } catch (apiError) {
            console.error('OpenWeather API Error:', apiError.response?.data || apiError.message);
            res.status(500).json({
                error: 'Failed to fetch weather data from OpenWeatherMap. Please check your API key and try again.'
            });
        }

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

// Helper function to process 3-hour forecast data into daily summaries
function processWeatherData(weatherData) {
    const dailyData = {};

    weatherData.list.forEach(item => {
        const date = item.dt_txt.split(' ')[0]; // Extract date (YYYY-MM-DD)
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });

        if (!dailyData[date]) {
            // Initialize for a new day
            dailyData[date] = {
                date: date,
                dayOfWeek: dayOfWeek,
                temp_min: item.main.temp_min,
                temp_max: item.main.temp_max,
                humidity: item.main.humidity,
                description: item.weather[0].description,
                icon: item.weather[0].icon,
                wind_speed: item.wind.speed,
                pressure: item.main.pressure,
                // Accumulators for average/dominant values
                temp_sum: item.main.temp,
                humidity_sum: item.main.humidity,
                wind_speed_sum: item.wind.speed,
                count: 1,
                weather_conditions: { [item.weather[0].main]: 1 } // Track dominant weather
            };
        } else {
            // Update existing day's data
            if (item.main.temp_min < dailyData[date].temp_min) {
                dailyData[date].temp_min = item.main.temp_min;
            }
            if (item.main.temp_max > dailyData[date].temp_max) {
                dailyData[date].temp_max = item.main.temp_max;
            }
            dailyData[date].temp_sum += item.main.temp;
            dailyData[date].humidity_sum += item.main.humidity;
            dailyData[date].wind_speed_sum += item.wind.speed;
            dailyData[date].count++;

            // Count weather conditions to find the most frequent one
            dailyData[date].weather_conditions[item.weather[0].main] =
                (dailyData[date].weather_conditions[item.weather[0].main] || 0) + 1;
        }
    });

    // Finalize daily data (calculate averages, find dominant weather)
    return Object.values(dailyData).map(day => {
        const dominantWeather = Object.keys(day.weather_conditions).reduce((a, b) =>
            day.weather_conditions[a] > day.weather_conditions[b] ? a : b
        );

        return {
            date: day.date,
            dayOfWeek: day.dayOfWeek,
            temp_min: day.temp_min,
            temp_max: day.temp_max,
            humidity: Math.round(day.humidity_sum / day.count), // Average humidity
            description: dominantWeather, // Use dominant weather description
            icon: day.icon, // Keep the icon from the first entry, or find dominant icon
            wind_speed: (day.wind_speed_sum / day.count).toFixed(1), // Average wind speed
            pressure: day.pressure // Pressure from one entry (can be averaged too)
        };
    }).slice(0, 7); // Limit to 7 days as OpenWeatherMap free tier provides 5-day forecast
}


// Start the server
app.listen(PORT, () => {
    console.log(`Harvest Nexus server running on http://localhost:${PORT}`);
});