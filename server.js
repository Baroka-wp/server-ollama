import express from 'express';
import axios from 'axios';
import cors from 'cors'; // Import cors
import { config } from 'dotenv';
import OpenAI from 'openai';
import {galleryItems} from './db.js';
import { ollamaChat, countryCapital, ollamaLang, ollama_functions, ollamaChain} from './lib/chat.js';

import { default as ollama } from 'ollama';

config();
const app = express();
const port = process.env.PORT || 3001;


app.use(cors()); // Use cors middleware
app.use(express.json());
// app.use(urlencoded({ extended: true }));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY});


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
    const userMessage = req.body.message
    try {
        const response = await ollamaChain(userMessage)
        res.status(200).json({ response });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});


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

app.post('/generate', async (req, res) => {
    const userMessage = req.body.message;

    console.log('User message:', userMessage);

    try {
        const completion = await openai.chat.completions.create({
            messages: [{"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": userMessage}],
            model: "gpt-3.5-turbo",
          });

        const botMessage = completion.choices[0].message.content.trim();
        res.status(200).json({ message: botMessage });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'An error occurred' });
    }

});

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
