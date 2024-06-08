import ollama from 'ollama';
import { Ollama } from "@langchain/community/llms/ollama";
import { OllamaFunctions } from "@langchain/community/experimental/chat_models/ollama_functions";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { 
    SystemMessagePromptTemplate, 
    HumanMessagePromptTemplate, 
    MessagesPlaceholder,
    ChatPromptTemplate 
  } from "@langchain/core/prompts"
import { ChatMessageHistory } from "langchain/stores/message/in_memory"


const get_current_weather = {
    name: "get_current_weather",
    description: "Get the current weather in a given location",
    parameters: {
        type: "object",
        properties: {
            location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
            },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
    },
}

const add_two_numbers = {
    name: "add_two_numbers",
    description: "Add two numbers",
    parameters: {
        type: "object",
        properties: {
            num1: { type: "number", description: "The first number" },
            num2: { type: "number", description: "The second number" },
        },
        required: ["num1", "num2"],
    },
}

const get_weather = () => {
    console.log("Current weather in Benin is 27C")

    return "Current weather in Benin is 27C"
}

const sum_numbers = (num1, num2) => {
    return num1 + num2;
};


const ollamaChat = async (message) => {
   
    try {

        const model = new ChatOllama({
            baseUrl: "http://localhost:11434", // Default value
            model: "llama2", // Default value
          });
        const stream = await model
            .pipe(new StringOutputParser())
            .stream(message);

        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        return chunks.join("")
        
    } catch (error) {
        console.error("Error in ollamaChat:", error);
        throw error;
    }
};

const ollamaChain = async (message, history) => {
    try {
        const model = new ChatOllama({
            baseUrl: "http://localhost:11434",
            model: "llama2",
            temperature: 0,
            repeatPenalty: 1,
            verbose: false
        });

        const prompt = ChatPromptTemplate.fromMessages([
            [
              "system",
              "You are a helpful assistant. Answer all questions to the best of your ability. Be consise. Be short Ask him his name if you don't have it. And personnalise the conversation",
            ],
            new MessagesPlaceholder("messages"),
          ]);

        // Initialize the chat memory
        const messageHistory = new ChatMessageHistory();

        // Add the existing history to the messageHistory
        for (const msg of history) {
            if (msg.role === 'system') {
                await messageHistory.addMessage(new AIMessage({ content: msg.content }));
            } else if (msg.role === 'human') {
                await messageHistory.addMessage(new HumanMessage({ content: msg.content }));
            }
        }

        // Add the new incoming message
        await messageHistory.addMessage(new HumanMessage({ content: message }));

        const outputParser = new StringOutputParser();

        const chain = prompt.pipe(model).pipe(outputParser);

        const responseMessage = await chain.invoke({
            messages: await messageHistory.getMessages()
        });

        console.log(responseMessage)

        return responseMessage;
    } catch (error) {
        console.error("Error in ollamaChain:", error);
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
            model: 'llama3',
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
            format: "json",
            stream: false,
            temperature: 0.2
        });

        return JSON.parse(response.message.content);
    } catch (error) {
        console.error("Error in ollamaChat:", error);
        throw error;
    }
};


const ollamaLang = async (msg) => {
    const ollama = new Ollama({
        baseUrl: "http://localhost:11434", // Default value
        model: "llama2", // Default value
        temperature: 0.1
      });

      console.log({msg})
      
      const stream = await ollama.stream(msg);
      
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const response = chunks.join("");

      return response
}




const ollama_functions = async (msg) => {
    const model = new OllamaFunctions({
        temperature: 0.1,
        model: "mistral",
    }).bind({
        functions: [
            add_two_numbers,
            get_current_weather
        ]
    });

    const response = await model.invoke([
        new HumanMessage({
            content: msg,
        }),
    ]);

    const function_called = response.additional_kwargs.function_call

    if (function_called.name === 'get_current_weather') {
        console.log(`fucntion name: ${function_called.name}`)

        const { location } = JSON.parse(function_called.arguments);
        const weather = get_weather(location);
        return `Current weather in ${location}: ${weather.temperature}C, ${weather.description}`;

    } else if ( function_called.name === 'add_two_numbers') {

        console.log(`fucntion name: ${function_called.name}`)

        const { num1, num2 } = JSON.parse(function_called.arguments);
        const result = sum_numbers(num1, num2);
        
        return `The sum of ${num1} and ${num2} is ${result}`;
    } else {
        return response.kwargs.additional_kwargs.function_call.name;
    }
        
};

export { ollamaChat, countryCapital, ollamaLang, ollama_functions, ollamaChain};
