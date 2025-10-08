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

interface GaDataParams {
  start_date?: string;
  end_date?: string;
  comparison_start_date?: string;
  comparison_end_date?: string;
  traffic_source_type?: string;
}

async function gaData(params: GaDataParams) {
  return generateRealisticData(params);
}

tool({
  name: 'ga_data',
  description: 'Returns Google Analytics data with optional date ranges and traffic source filtering',
  parameters: [
    {
      name: 'start_date',
      description: 'Start date for the primary period in YYYY-MM-DD format (e.g., "2024-01-01")',
      type: ParameterType.String,
      required: false
    },
    {
      name: 'end_date',
      description: 'End date for the primary period in YYYY-MM-DD format (e.g., "2024-01-31")',
      type: ParameterType.String,
      required: false
    },
    {
      name: 'comparison_start_date',
      description: 'Start date for the comparison period in YYYY-MM-DD format (e.g., "2023-01-01")',
      type: ParameterType.String,
      required: false
    },
    {
      name: 'comparison_end_date',
      description: 'End date for the comparison period in YYYY-MM-DD format (e.g., "2023-01-31")',
      type: ParameterType.String,
      required: false
    },
    {
      name: 'traffic_source_type',
      description: 'Filter by traffic source type (e.g., "referral", "organic", "direct", "social")',
      type: ParameterType.String,
      required: false
    }
  ]
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

function generateRealisticData(params?: GaDataParams): ReportData {
  const filePath = path.resolve(process.cwd(), "netlify/assets/ga4_pages_and_screens.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const ga4Data = JSON.parse(raw);

  const getValue = (row: any, key: string) => {
    const lower = key.toLowerCase().trim();
    const match = Object.keys(row).find(k =>
      k.toLowerCase().trim().includes(lower)
    );
    return match ? row[match] : 0;
  };

  let dateAdjustmentFactor = 1.0;
  if (params?.start_date && params?.end_date) {
    const startDate = new Date(params.start_date);
    const endDate = new Date(params.end_date);
    const daysDiff = Math.abs((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    dateAdjustmentFactor = daysDiff / 30;
  }

  // Calculate comparison adjustment factor
  let comparisonAdjustmentFactor = 0.9; // Default: 10% less in previous period
  if (params?.comparison_start_date && params?.comparison_end_date) {
    const compStartDate = new Date(params.comparison_start_date);
    const compEndDate = new Date(params.comparison_end_date);
    const compDaysDiff = Math.abs((compEndDate.getTime() - compStartDate.getTime()) / (1000 * 60 * 60 * 24));
    comparisonAdjustmentFactor = 0.85 + (compDaysDiff / 100);
  }

  let sessions = ga4Data.reduce((sum: number, row: any) => sum + (getValue(row, "Views") || 0), 0);
  let users = ga4Data.reduce((sum: number, row: any) => sum + (getValue(row, "Users") || 0), 0);

  sessions = Math.round(sessions * dateAdjustmentFactor);
  users = Math.round(users * dateAdjustmentFactor);

  const engagementRate = 100 * (users ? sessions / users : 0);

  let prevSessions = Math.round(sessions * comparisonAdjustmentFactor);
  let prevUsers = Math.round(users * (comparisonAdjustmentFactor + 0.02));
  const prevEngagementRate = Math.max(engagementRate - 2.5, 0);
  let keyEvents = Math.round(sessions * 0.05);
  let prevKeyEvents = Math.round(keyEvents * comparisonAdjustmentFactor);
  let sessionKeyEventRate = 100 * (keyEvents / sessions);
  let prevSessionKeyEventRate = sessionKeyEventRate - 0.5;

  const pages = ga4Data
    .sort((a: any, b: any) => (getValue(b, "Views") || 0) - (getValue(a, "Views") || 0))
    .map((row: any) => {
      const pageViews = Math.round(getValue(row, "Views") * dateAdjustmentFactor);
      return {
        path:
          getValue(row, "Paths") ||
          getValue(row, "Page path and screen class") ||
          getValue(row, "Landing page + query string") ||
          "/unknown",
        sessions: pageViews,
        prevSessions: Math.round(pageViews * comparisonAdjustmentFactor),
        keyEventRate: Math.random() * 20,
        prevKeyEventRate: Math.random() * 20,
      };
    });

  let channelsData = [
    { name: "Organic Search", sessions: Math.round(sessions * 0.4), type: "organic" },
    { name: "Direct", sessions: Math.round(sessions * 0.25), type: "direct" },
    { name: "Referral", sessions: Math.round(sessions * 0.2), type: "referral" },
    { name: "Social", sessions: Math.round(sessions * 0.15), type: "social" }
  ];

  if (params?.traffic_source_type) {
    const filterType = params.traffic_source_type.toLowerCase();
    channelsData = channelsData.filter(c => c.type === filterType);

    if (channelsData.length > 0) {
      const filteredSessions = channelsData[0].sessions;
      sessions = filteredSessions;
      users = Math.round(sessions * 0.7);
      keyEvents = Math.round(sessions * 0.05);
      prevSessions = Math.round(sessions * comparisonAdjustmentFactor);
      prevUsers = Math.round(users * (comparisonAdjustmentFactor + 0.02));
      prevKeyEvents = Math.round(keyEvents * comparisonAdjustmentFactor);
      sessionKeyEventRate = 100 * (keyEvents / sessions);
      prevSessionKeyEventRate = sessionKeyEventRate - 0.5;
    }
  }

  const channels = channelsData.map(c => ({
    name: c.name,
    sessions: c.sessions,
    prevSessions: Math.round(c.sessions * comparisonAdjustmentFactor),
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
