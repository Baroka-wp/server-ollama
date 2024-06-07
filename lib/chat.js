const { default: ollama } = require('ollama');

const ollamaChat = async (message) => {
    try {
        const response = await ollama.chat({
            model: 'mistral:latest',
            messages: [
                {
                    role: "system",
                    content: "You are an AI, named Saed-AI, designed to maintain fluid and straightforward conversations with users. Respond to messages concisely and consistently, taking into account previous interactions.",
                },
                {
                    role: "user",
                    content: message,
                },
            ],
        });

        return response.message.content;
    } catch (error) {
        console.error("Error in ollamaChat:", error);
        throw error;
    }
};


const countryCapital = async (country) => {
    const schema = {
        "city": {
            "type":"string",
            "description":"Name of the city"
        },
        "lat": {
            "type":"float",
            "description":"Decimal Latitude of the city"
        },
        "lon": {
            "type":"float",
            "description":"Decimal Longitude of the city"
        }

    }
    try {
        const response = await ollama.chat({
            model: 'mistral:latest',
            messages: [
                {
                    role: "system",
                    content: `You are a helpfull assistant. The user will enter a country name
                            and the assistant will return the decimal latitude and longitude of capital of the country.
                            Output in JSON using the schema defined here: ${schema}.`,
                },
                {
                    role: "user",
                    content: `What is the capitl of ${country}`,
                },
                {
                    role: "assistant",
                    content: `{\"city\":\"Paris\",\"lat\":48.8566,\"lon\":2.3522}`,
                }
            ],
            format: "json"
        });

        return JSON.parse(response.message.content);
    } catch (error) {
        console.error("Error in ollamaChat:", error);
        throw error;
    }
};

module.exports = {ollamaChat, countryCapital};
