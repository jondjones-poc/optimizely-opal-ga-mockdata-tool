import { tool, ParameterType, ToolsService } from "@optimizely-opal/opal-tools-sdk";
import cors from "cors";
import express from "express";
import { Handler } from '@netlify/functions';
import fs from "fs";
import path from "path";

const serverless = require('serverless-http');
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const handler: Handler = serverless(app);
export { handler };

const toolsService = new ToolsService(app);

async function gaData() {
  return generateRealisticData();
}

tool({
  name: 'ga_data',
  description: 'Returns mock GA data',
  parameters: [] as { name: string; description: string; type: ParameterType; required: boolean }[]
})(gaData);

if (process.env.NODE_ENV !== 'production' || process.env.NETLIFY !== 'true') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Discovery endpoint: http://localhost:${PORT}/discovery`);
  });
}

export { app };

interface ReportData {
  sessions: number;
  prevSessions: number;
  users: number;
  prevUsers: number;
  engagementRate: number;
  prevEngagementRate: number;
  keyEvents: number;
  prevKeyEvents: number;
  sessionKeyEventRate: number;
  prevSessionKeyEventRate: number;
  pages: Array<{
    path: string;
    sessions: number;
    prevSessions: number;
    keyEventRate: number;
    prevKeyEventRate: number;
  }>;
  channels: Array<{
    name: string;
    sessions: number;
    prevSessions: number;
    keyEventRate: number;
    prevKeyEventRate: number;
  }>;
}

function generateRealisticData(): ReportData {
  const filePath = path.resolve(process.cwd(), "netlify/assets/ga4_pages_and_screens.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const ga4Data = JSON.parse(raw);

  // Normalize column names for safety
  const getValue = (row: any, key: string) => {
    const lower = key.toLowerCase().trim();
    const match = Object.keys(row).find(k =>
      k.toLowerCase().trim().includes(lower)
    );
    return match ? row[match] : 0;
  };

  const sessions = ga4Data.reduce((sum: number, row: any) => sum + (getValue(row, "Views") || 0), 0);
  const users = ga4Data.reduce((sum: number, row: any) => sum + (getValue(row, "Users") || 0), 0);
  const engagementRate = 100 * (users ? sessions / users : 0);

  const prevSessions = Math.round(sessions * 0.9);
  const prevUsers = Math.round(users * 0.92);
  const prevEngagementRate = Math.max(engagementRate - 2.5, 0);
  const keyEvents = Math.round(sessions * 0.05);
  const prevKeyEvents = Math.round(keyEvents * 0.9);
  const sessionKeyEventRate = 100 * (keyEvents / sessions);
  const prevSessionKeyEventRate = sessionKeyEventRate - 0.5;

  // --- Pages Breakdown ---
  const pages = ga4Data
    .sort((a: any, b: any) => (getValue(b, "Views") || 0) - (getValue(a, "Views") || 0))
    .map((row: any) => ({
path:
  getValue(row, "Paths") ||
  getValue(row, "Page path and screen class") ||
  getValue(row, "Landing page + query string") ||
  "/unknown",
  sessions: getValue(row, "Views"),
  prevSessions: Math.round(getValue(row, "Views") * 0.9),
  keyEventRate: Math.random() * 20,
  prevKeyEventRate: Math.random() * 20,
      }));

  // --- Channels Breakdown (fallback if no channel column exists) ---
  const channels = [
    { name: "Organic Search", sessions: Math.round(sessions * 0.4) },
    { name: "Direct", sessions: Math.round(sessions * 0.25) },
    { name: "Referral", sessions: Math.round(sessions * 0.2) },
    { name: "Social", sessions: Math.round(sessions * 0.15) }
  ].map(c => ({
    ...c,
    prevSessions: Math.round(c.sessions * 0.9),
    keyEventRate: Math.random() * 15 + 5,
    prevKeyEventRate: Math.random() * 15 + 5
  }));

  return {
    sessions,
    prevSessions,
    users,
    prevUsers,
    engagementRate,
    prevEngagementRate,
    keyEvents,
    prevKeyEvents,
    sessionKeyEventRate,
    prevSessionKeyEventRate,
    pages,
    channels,
  };
}
