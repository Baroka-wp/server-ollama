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
import { chatFlowGraph } from './chatflow.js';

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

const chating = {
    "name": "chating",
    "description": "chat with user",
    "parameters": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string",
          "description": "user send a response. That is not a question or not related to other"
        }
      },
      "required": [
        "message"
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
          LIMIT 4`,
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
            model: "llama3:latest", // Default value
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

const ollamaChain = async (message, history, user_id, session) => {
    try {
        const model = new ChatOllama({
            baseUrl: "http://localhost:11434",
            model: "llama3:latest",
            temperature: 0,
            repeatPenalty: 1,
            verbose: false
        });

        const user = await pool.query(
            `SELECT chat_node FROM history WHERE user_id = $1 AND session = $2`,
            [user_id, session]
        );

        const chat_node = user.rows[0]?.chat_node

        const question = chatFlowGraph[chat_node]?.message

        console.log({chat_node})
        console.log({question})

        const prompt = ChatPromptTemplate.fromMessages([
            [
              "system",
              `Juste Ask this question to user ${question}. Nothing else`,
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


        history.push(
            {
                role: "human",
                content: message
            },
            {
                role: "system",
                content: responseMessage
            }
        );

        const new_chat_node = chatFlowGraph[chat_node]?.next

        console.log({new_chat_node})

        await pool.query(
            `UPDATE history SET message = $1, chat_node = $2 WHERE user_id = $3 AND session = $4`,
            [history,new_chat_node,user_id, session]
        );

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

const ollama_functions = async (msg,history,user_id, session) => {
    const model = new OllamaFunctions({
        temperature: 0,
        model: "llama3:latest",
    }).bind({
        functions: [
            answer_question,
            chating
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

    if (function_called.name === 'chating') {
        console.log(`fucntion name: ${function_called.name}`)
        const { message } = JSON.parse(function_called.arguments);

        const user = await pool.query(
            `SELECT message FROM history WHERE user_id = $1 AND session = $2`,
            [user_id, session]
        );
    
        const response = await ollamaChain(message, history, user_id, session)
        console.log({response})

        return response
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
