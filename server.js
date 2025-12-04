require("dotenv").config();
// console.log(process.env.PG_USER);
const express = require("express");
const app = express();
const port = 3120;
const client = require("./config/db-connect").client;

// Environment logging for debugging
console.log("Environment:", process.env.NODE_ENV || "development");
console.log("Vercel:", process.env.VERCEL ? "Yes" : "No");
console.log("Database type:", process.env.ENV !== "development" ? "PostgreSQL" : "MySQL");
const bodyParser = require("body-parser");
const cors = require("cors");
const responseBuilder = require("./utils/responsebuilder");

// Setup CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
    preflightContinue: false,
  })
);

// معالج JSON مع معالجة الأخطاء
app.use(
  bodyParser.json({
    limit: "10mb",
    verify: (req, res, buf, encoding) => {
      try {
        JSON.parse(buf);
      } catch (err) {
        console.error("❌ Invalid JSON received:", err.message);
        console.error("📄 Raw body:", buf.toString());
      }
    },
  })
);

// معالج أخطاء JSON
// app.use((err, req, res, next) => {
//   if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
//     console.error("❌ JSON Parse Error:", err.message);
//     console.error("🔗 Request URL:", req.url);
//     console.error("📦 Request Method:", req.method);

//     return responseBuilder.badRequest(
//       res,
//       "Invalid JSON format. Please check your request body."
//     );
//   }
//   next(err);
// });
// CORS for uploads
app.use("/uploads", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Serve static files
app.use("/uploads", express.static("uploads"));

// Preflight for fetch
app.options("/uploads", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.sendStatus(200);
});

// Secure file access proxy for external/uploads resources
app.get("/api/access-file", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing 'url' query parameter");
    }

    const parsed = new URL(url);
    const allowedHosts = ["api.medgap.net", "localhost", "127.0.0.1"];
    if (!allowedHosts.includes(parsed.hostname)) {
      return res.status(400).send("Blocked host");
    }

    if (!parsed.pathname.startsWith("/uploads/")) {
      return res.status(400).send("Blocked path");
    }

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).send("Failed to fetch upstream file");
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) {
      res.setHeader("Content-Disposition", disposition);
    }
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) {
      res.setHeader("Cache-Control", cacheControl);
    }

    upstream.body.pipe(res);
  } catch (err) {
    console.error("/api/access-file error:", err);
    return res.status(500).send("Internal server error");
  }
});

// -------------------- Admin Routes 
const admins = require("./routes/admin-copy/admins/manage-users/index");
app.use("/api/admin/users", admins);
const adminRoles = require("./routes/admin-copy/admins/roles/index");
app.use("/api/admin/users/roles/", adminRoles);
const adminAuth = require("./routes/admin-copy/admins/auth/index");
app.use("/api/admin/auth", adminAuth);
const adminSubscriptionCards = require("./routes/admin-copy/admins/subscription-cards");
app.use("/api/admin/subscription-cards", adminSubscriptionCards);
const adminExamsRoute = require("./routes/admin/exams");
app.use("/api/admin/exams", adminExamsRoute);
const adminFreeAccess = require("./routes/admin/free-access");
app.use("/api/admin/free-access", adminFreeAccess);

const teachers = require("./routes/teacher/index");
app.use("/api/admin/teachers", teachers);

const modules = require("./routes/modules/index");
app.use("/api/admin/modules", modules);

const topics = require("./routes/topics/index");
app.use("/api/admin/topics", topics);

const questions = require("./routes/questions/index");
app.use("/api/admin/questions", questions);

const flashcards = require("./routes/flashcards/index");
app.use("/api/admin/flashcards", flashcards);

const ebooks = require("./routes/ebooks/index");
app.use("/api/admin/e-books", ebooks);
// -------------------- Admin Routes 
// ==================================================================================

// -------------------- Teacher Routes ---------------------------
const teacherAuth = require("./routes/teacher-panel/auth");
app.use("/api/teacher/auth", teacherAuth); 

const teacherModules = require("./routes/teacher-panel/teacher-modules");
app.use("/api/teacher/my-modules", teacherModules); 
const teacherFreeAccess = require("./routes/teacher/free-access");
app.use("/api/teacher/free-access", teacherFreeAccess);

// -------------------- Student Routes ---------------------------
const studentAuth = require("./routes/student/auth");
app.use("/api/student/auth", studentAuth);

const studentStudyTasks = require("./routes/student/study-tasks");
app.use("/api/student/study", studentStudyTasks);

const studentStudyPlans = require("./routes/student/study-plans");
app.use("/api/student/plans", studentStudyPlans);

const studentDigitalLibrary = require("./routes/student/digital-library");
app.use("/api/student/library", studentDigitalLibrary);

const studentFlashcards = require("./routes/student/flashcards");
app.use("/api/student/flashcards", studentFlashcards);

const studentQbank = require("./routes/student/qbank");
app.use("/api/student/qbank", studentQbank);
const studentSubscriptions = require("./routes/student/subscriptions");
app.use("/api/student/subscriptions", studentSubscriptions);
const studentHomePage = require("./routes/student/home-page");
app.use("/api/student/home", studentHomePage);

const adminQuotes = require("./routes/admin/quotes");
app.use("/api/admin/quotes", adminQuotes);

const adminOverview = require("./routes/admin/index");
app.use("/api/admin", adminOverview);


const teacherExams = require("./routes/teacher/exams");
app.use("/api/teacher/exams", teacherExams);

const teacherDashboard = require("./routes/teacher/dashboard");
app.use("/api/teacher/dashboard", teacherDashboard);
app.get("/", async (req, res) => {
  const getData = await client.query("SELECT NOW() FROM students LIMIT 1");
  console.log("Database Time:", getData.rows[0]);
  res.send("Welcome to the MedGap API Server");
});
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err.message);
  console.error("🔗 Request URL:", req.url);
  console.error("📦 Request Method:", req.method);
  console.error("📋 Stack:", err.stack);

  // if (!res.headersSent) {
  //   return responseBuilder.serverError(res, "An unexpected error occurred");
  // }
});

// app.use((req, res) => {
//   return responseBuilder.notFound(
//     res,
//     `Route ${req.method} ${req.originalUrl} not found`
//   );
// });

// For Vercel deployment, export the app instead of listening
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
  });
}
