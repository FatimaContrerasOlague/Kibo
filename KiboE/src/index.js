require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ingestRoutes = require('./routes/ingest.routes');
const chatRoutes = require('./routes/chat.routes');
const healthRoutes = require('./routes/health');
const assignmentsRoutes = require('./routes/assignments.routes');
const resourcesRoutes = require('./routes/resources.routes');
const summariesRoutes = require('./routes/summaries.routes');
const quizzesRoutes = require('./routes/quizzes.routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Aquí deben estar montadas las rutas
app.use('/health', healthRoutes);
app.use('/ingest', ingestRoutes);
app.use('/chat', chatRoutes);
app.use('/assignments', assignmentsRoutes);
app.use('/resources', resourcesRoutes);
app.use('/summaries', summariesRoutes);
app.use('/quizzes', quizzesRoutes);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
