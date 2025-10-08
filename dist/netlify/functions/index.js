"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.handler = void 0;
const opal_tools_sdk_1 = require("@optimizely-opal/opal-tools-sdk");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const serverless = require('serverless-http');
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use('/public', express_1.default.static('public'));
const handler = serverless(app);
exports.handler = handler;
const toolsService = new opal_tools_sdk_1.ToolsService(app);
async function bonuslyPointCalculator() {
    return {
        name: 'Jon'
    };
}
(0, opal_tools_sdk_1.tool)({
    name: 'bonus_point_calculator',
    description: 'Returns a string',
    parameters: []
})(bonuslyPointCalculator);
if (process.env.NODE_ENV !== 'production' || process.env.NETLIFY !== 'true') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Discovery endpoint: http://localhost:${PORT}/discovery`);
    });
}
