import express from 'express';
import axios from 'axios';
// import pgvector from "pgvector/pg";
import pool from './configs/db.js';
import cors from 'cors'; // Import cors
import { config } from 'dotenv';
import OpenAI from 'openai';
import {galleryItems} from './db.js';
import { 
    ollamaChat, 
    countryCapital, 
    ollamaLang, 
    ollama_functions, 
    ollamaChain,
    ollama_embeding
} from './lib/chat.js';

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";

config();
const app = express();
const port = process.env.PORT || 3001;


app.use(cors()); // Use cors middleware
app.use(express.json());
// app.use(urlencoded({ extended: true }));

// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY});


// Define endpoint for chat
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message
    try {
        const response = await ollama_functions(userMessage)
        res.status(200).json({ message: response });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});


// Define endpoint for chat
app.post('/langchat', async (req, res) => {

    const {user_id, session, message} = req.body;
    
    const user = await pool.query(
        `SELECT message FROM history WHERE user_id = $1 AND session = $2`,
        [user_id, session]
    );

    let history = []
    if(!user.rows.length) {
        const chat_node = "start"
        const messges = [{
            role: "human",
            content: message
        }];
        await pool.query(
            `INSERT INTO history (user_id, session, message,chat_node ) VALUES ($1, $2, $3, $4)`,
            [user_id, session, messges, chat_node]
        );
    } else {
        history = user.rows[0].message
    }

    console.log(history)

    try {
        const response = await ollama_functions(message,history,user_id, session)

        res.status(200).json({ response });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

// Define endpoint for chat
app.post('/embeding', async (req, res) => {
    const doc = req.body.doc;
    console.log(doc)
    try {
        const response = await ollama_embeding(doc)
        res.status(200).json({ message: response });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

app.get('/retrieve', async (req, res) => {

    const loader = new CheerioWebBaseLoader(
    "https://docs.smith.langchain.com/user_guide"
    );
    const rawDocs = await loader.load();

    console.log(rawDocs)

    const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    });


    const docs = await splitter.splitDocuments(rawDocs);

    console.log({docs})

    const vectorstore = await MemoryVectorStore.fromDocuments(
        docs,
        new OpenAIEmbeddings()
    );
    const retriever = vectorstore.asRetriever();

    const retrieverResult = await retriever.getRelevantDocuments(
    "how to upload a dataset"
    );
    console.log(retrieverResult[0]);


    return retrieverResult[0]

})


// Define endpoint for chat
app.post('/get_capital', async (req, res) => {
    const userMessage = req.body.message;
    console.log(userMessage)
    try {
        const response = await countryCapital(userMessage)
        res.status(200).json({ message: response });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

// app.post('/generate', async (req, res) => {
//     const userMessage = req.body.message;

//     console.log('User message:', userMessage);

//     try {
//         const completion = await openai.chat.completions.create({
//             messages: [{"role": "system", "content": "You are a helpful assistant."},
//                 {"role": "user", "content": userMessage}],
//             model: "gpt-3.5-turbo",
//           });

//         const botMessage = completion.choices[0].message.content.trim();
//         res.status(200).json({ message: botMessage });
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: 'An error occurred' });
//     }

// });

app.get('/gallery', (req, res) => {
    const items = galleryItems
    res.json({ items: items });
});

app.get('/', (req, res) => {
    res.json({ message: 'Hello World!' });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
