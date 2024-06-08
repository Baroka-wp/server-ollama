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
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import pool from '../configs/db.js';
import pgvector from "pgvector/pg";
import { OpenAIEmbeddings } from "@langchain/openai";

process.env.LANGCHAIN_CALLBACKS_BACKGROUND=true

const answer_question = {
    "name": "answer_question",
    "description": "answer to client question",
    "parameters": {
      "type": "object",
      "properties": {
        "question": {
          "type": "string",
          "description": "user question's about generale question"
        }
      },
      "required": [
        "question"
      ]
    }
}

const get_faq = async (question) => {
    try {
      // Embed question with OpenAI
      const createEmbedding = new OpenAIEmbeddings();
      const questionEmbedding = await createEmbedding.embedQuery(question);
  
      // Requête pour obtenir les FAQ les plus proches
      const faq = await pool.query(
        `SELECT
            question,
            answer
          FROM "Faq"
          ORDER BY embedding <-> $1
          LIMIT 3`,
        [pgvector.toSql(questionEmbedding)]
      );
  
      if (faq.rows.length === 0) {
        return null;
      } else {
        const results = faq.rows;


        class Document {
            constructor({ pageContent, metadata }) {
              this.pageContent = pageContent;
              this.metadata = metadata;
            }
          }
  
        // Créer un tableau des réponses
        const docs = results.map(d => new Document({
            pageContent: d.answer,
            metadata: { question: d.question }
          }));
  
        // Diviser les documents en chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 500,
          chunkOverlap: 0,
        });
  
        const allSplits = await textSplitter.splitDocuments(docs);
  
        // Vérifier si les documents sont correctement divisés  
        if (allSplits.length === 0) {
          console.error('Error: No document splits created.');
          return null;
        }
  
        // Générer des embeddings pour les documents
        const vectorStore = await MemoryVectorStore.fromDocuments(
          allSplits,
          new OpenAIEmbeddings()
        );
  
        // Rechercher les documents les plus similaires
        const answer = await vectorStore.similaritySearch(question);
  
        // Vérifier si la recherche de similarité renvoie des résultats  
        if (answer.length === 0) {
          console.error('Error: No similar documents found.');
          return null;
        }
  
        // Retourner la réponse la plus pertinente
        return answer[0].pageContent;
      }
    } catch (error) {
      console.error('Error in get_faq:', error);
      throw error;
    }
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
              "You are a helpful assistant. Answer all questions to the best of your ability. Be consise. Ask him his name if you don't have it. And personnalise the conversation",
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
            answer_question
        ]
    });

    const response = await model.invoke([
        new HumanMessage({
            content: msg,
        }),
    ]);

    const function_called = response.additional_kwargs.function_call

    if (function_called.name === 'answer_question') {
        console.log(`fucntion name: ${function_called.name}`)

        const { question } = JSON.parse(function_called.arguments);
        const answer = get_faq(question);
        return answer;

    } 

    return "No function called";

        
};


const ollama_embeding = async (doc) => {

    const embeddings = new OllamaEmbeddings({
        model: "llama2", // default value
        baseUrl: "http://localhost:11434", // default value
        requestOptions: {
          useMMap: true, // use_mmap 1
          numThread: 6, // num_thread 6
          numGpu: 1, // num_gpu 1
          dimensions: 1536
        },
    });

    const document = [doc]

    const documentEmbeddings = await embeddings.embedDocuments(document);

    return documentEmbeddings
}


export { ollamaChat, countryCapital, ollamaLang, ollama_functions, ollamaChain, ollama_embeding};
