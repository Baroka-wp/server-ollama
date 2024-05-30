const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors'); // Import cors
const dotenv = require('dotenv');
const OpenAI = require('openai');
const galleryItems = require('./db.js');

dotenv.config();
const app = express();
const port = process.env.PORT || 3001;


app.use(cors()); // Use cors middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY});

// Define endpoint for chat
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    console.log('User message:', userMessage);

    try {
        const response = await axios.post('http://213.130.144.157:11434/api/generate', {
            model: 'mistral:latest',
            prompt: userMessage,
            stream: false // Assuming you want the full response at once, not streamed
        });

        const bodyMsg = response.data.response
        res.json({ message: bodyMsg });
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
