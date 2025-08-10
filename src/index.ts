import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from "zod";
import { logger } from "./logger.js";

const serverConfig = {
    name: "weather-mcp",
    version: "1.0.0"
};

const createLogContext = (operation: string, additionalContext: Record<string, any> = {}) => ({
    serverName: serverConfig.name,
    serverVersion: serverConfig.version,
    operation,
    timestamp: new Date().toISOString(),
    ...additionalContext
});

const server = new McpServer({
    name: "weather-server",
    version: "1.0.0",
    description: "A weather server that provides weather information for a given location",
}, {
    capabilities: {
        logging: {},
        resources: {},
        tools: {},
    }
});

logger.info('Initializing MCP Server', createLogContext('server_init', {
    capabilities: ['logging', 'resources', 'tools']
}));

server.tool(
    "get-weather",
    "Tool to get the weather for a given location",
    {
        city: z.string().describe("The city to get the weather for"),
    },

    async ({ city }) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const toolContext = { requestId, city, tool: 'get-weather' };
        
        logger.info('Weather request initiated', createLogContext('tool_request_start', toolContext));

        try {
            // 1. Geocoding API call
            logger.info('Starting geocoding lookup', createLogContext('geocoding_start', {
                ...toolContext,
                geocodingUrl: `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`
            }));

            const geoStartTime = Date.now();
            const geoResponse = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`
            );

            const geoResponseTime = Date.now() - geoStartTime;

            if (!geoResponse.ok) {
                logger.error('Geocoding API request failed', createLogContext('geocoding_error', {
                    ...toolContext,
                    status: geoResponse.status,
                    statusText: geoResponse.statusText,
                    responseTime: geoResponseTime
                }));

                return {
                    content: [{
                        type: "text",
                        text: `Failed to fetch location data for ${city}. Status: ${geoResponse.status}`,
                    }],
                };
            }

            const geoData = await geoResponse.json();

            logger.info('Geocoding lookup completed', createLogContext('geocoding_success', {
                ...toolContext,
                responseTime: geoResponseTime,
                resultsCount: geoData?.results?.length || 0,
                geoData: geoData?.results?.[0] ? {
                    name: geoData.results[0].name,
                    country: geoData.results[0].country,
                    latitude: geoData.results[0].latitude,
                    longitude: geoData.results[0].longitude
                } : null
            }));

            if (!geoData || !geoData.results || geoData.results.length === 0) {
                logger.warn('No geocoding results found', createLogContext('geocoding_no_results', toolContext));

                return {
                    content: [{
                        type: "text",
                        text: `No results found for ${city}`,
                    }],
                };
            }

            // 2. Weather API call
            const { latitude, longitude, name: locationName, country } = geoData.results[0];
            const weatherContext = {
                ...toolContext,
                latitude,
                longitude,
                locationName,
                country
            };

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&weather_code&forecast_days=1`;

            logger.info('Starting weather data fetch', createLogContext('weather_start', {
                ...weatherContext,
                weatherUrl
            }));

            const weatherStartTime = Date.now();
            const weatherResponse = await fetch(weatherUrl);
            const weatherResponseTime = Date.now() - weatherStartTime;

            if (!weatherResponse.ok) {
                logger.error('Weather API request failed', createLogContext('weather_error', {
                    ...weatherContext,
                    status: weatherResponse.status,
                    statusText: weatherResponse.statusText,
                    responseTime: weatherResponseTime
                }));

                return {
                    content: [{
                        type: "text",
                        text: `Failed to fetch weather data for ${locationName}, ${country}. Status: ${weatherResponse.status}`,
                    }],
                };
            }

            const weatherData = await weatherResponse.json();

            logger.info('Weather data fetch completed', createLogContext('weather_success', {
                ...weatherContext,
                responseTime: weatherResponseTime,
                currentWeather: weatherData?.current ? {
                    temperature: weatherData.current.temperature_2m,
                    humidity: weatherData.current.relative_humidity_2m,
                    apparent_temperature: weatherData.current.apparent_temperature,
                    precipitation: weatherData.current.precipitation,
                    weather_code: weatherData.current.weather_code
                } : null
            }));

            const totalRequestTime = Date.now() - geoStartTime;
            logger.info('Weather request completed successfully', createLogContext('tool_request_success', {
                ...toolContext,
                totalRequestTime,
                geocodingTime: geoResponseTime,
                weatherTime: weatherResponseTime
            }));

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(weatherData, null, 2),
                }]
            };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Weather request failed with exception', createLogContext('tool_request_error', {
                ...toolContext,
                error: errorMessage,
                errorType: error instanceof Error ? error.constructor.name : typeof error,
                stack: errorStack
            }));

            return {
                content: [{
                    type: 'text',
                    text: `Error fetching weather for ${city}: ${errorMessage}`,
                }]
            };
        }
    }
);

logger.info('Attempting to connect MCP Server transport', createLogContext('transport_connect_start'));

const transport = new StdioServerTransport();

try {
    await server.connect(transport);
    
    logger.info('MCP Server started successfully', createLogContext('server_start_success', {
        transport: 'stdio',
        tools: ['get-weather'],
        pid: process.pid
    }));

} catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Failed to start MCP Server', createLogContext('server_start_error', {
        transport: 'stdio',
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error
    }));
    
    process.exit(1);
}

process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully', createLogContext('server_shutdown', {
        reason: 'SIGINT'
    }));
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully', createLogContext('server_shutdown', {
        reason: 'SIGTERM'
    }));
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', createLogContext('uncaught_exception', {
        error: error.message,
        stack: error.stack
    }));
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', createLogContext('unhandled_rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
    }));
});