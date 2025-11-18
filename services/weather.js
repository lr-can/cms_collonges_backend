const fs = require('fs');
async function getWeatherLabelForCode(code) {
    const data = JSON.parse(fs.readFileSync('ressources/translated_full_weather_codes.json', 'utf8'));
    if (data.weatherCode[code]){
        return {
            result: data.weatherCode[code]
        };
    } else if (data.weatherCodeFullDay[code]){
        return {
            result: data.weatherCodeFullDay[code]
        };
    } else {
        return {
            result: data.weatherCode["0"]
        };
    }
}

module.exports = {
    getWeatherLabelForCode
};