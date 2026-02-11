import { GoogleGenAI } from "@google/genai";
import { Transaction, Category } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getFinancialAdvice(
  transactions: Transaction[], 
  categories: Category[],
  extraContext?: {
    averages: Record<string, number>,
    trends: { month: string, income: number, expense: number }[]
  }
) {
  const transactionData = transactions.map(t => ({
    date: t.date,
    desc: t.description,
    amount: t.amount,
    type: t.type,
    category: categories.find(c => c.id === t.categoryId)?.name
  }));

  const contextPrompt = extraContext ? `
  Category Monthly Averages: ${JSON.stringify(extraContext.averages)}
  Historical Trends (Last 6 Months): ${JSON.stringify(extraContext.trends)}
  ` : '';

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze these financial records and provide 3-4 professional, strategic insights. 
    Focus on anomaly detection, efficiency improvements, and growth opportunities.
    ${contextPrompt}
    Recent Transactions: ${JSON.stringify(transactionData.slice(-15))}`,
    config: {
      systemInstruction: "You are a senior CPA and financial strategist. Provide high-level advice that goes beyond simple summaries. Use professional terminology and markdown for clear structure.",
      temperature: 0.6,
    },
  });

  return response.text;
}

export async function suggestCategory(description: string, categories: Category[]) {
  const categoryNames = categories.map(c => c.name).join(', ');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on the description "${description}", which of these categories best fits? Options: ${categoryNames}. Return only the category name.`,
    config: {
      temperature: 0.1,
    }
  });

  return response.text?.trim();
}