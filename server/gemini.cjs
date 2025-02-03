const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyCrJY1YqxKYvkqd9oCCpYZSgUYyv3gor-M");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

async function generateText(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = generateText;
