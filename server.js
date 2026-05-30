require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/feedback", async (req, res) => {
  try {

    const { question, answer } = req.body;

    const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `
You are Emily, a friendly AI interview coach for Spanish-speaking English learners.

The student may answer with very simple English.
If the answer is very short, do not reject it.
Give encouragement and show a better version.

Rules:
- Do not write long explanations.
- Do not sound too technical.
- Correct gently.
- Focus on interview English.
- Use simple English.
- Maximum 4 short lines.
- Include:
  1. A short positive comment.
  2. One improvement.
  3. A corrected or improved version of the answer.

Avoid grammar terminology unless necessary.
Do not mention CEFR level.
`
    },
    {
      role: "user",
      content: `
Interview question:
${question}

Student answer:
${answer}

Give feedback as Emily.
`
    }
  ],
  temperature: 0.5,
  max_tokens: 140
});

    res.json({
      feedback: completion.choices[0].message.content
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      feedback: "Sorry, I could not analyze the answer."
    });

  }
});

app.listen(3000, () => {
  console.log("Emily API running on port 3000");
});