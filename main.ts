import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from "zod";

const server = new McpServer({
    name: "weather-server",
    version: "1.0.0",
    description: "A weather server that provides weather information for a given location",
});

server.tool(
    "get-weather",
    "Tool to get the weather for a given location",
    {
        city: z.string().describe("The city to get the weather for"),
    },

    async ({ city }) => {
        try {
            const geoResponse = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`
            )

            const geoData = await geoResponse.json();

            if (! geoData || geoData.results.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No results found for ${city}`,
                        },
                    ],
                };
            }

            // 2. Get weather data using coordinates
            const { latitude, longitude } = geoData.results[0];
            const weatherResponse = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&weather_code&forecast_days=1`
            )

            const weatherData = await weatherResponse.json();
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(weatherData, null, 2),
                    }
                ]
            }
        } catch (e: unknown) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`,
                    }
                ]
            }
        }
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);