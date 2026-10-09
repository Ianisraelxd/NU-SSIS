// Feature switches. This project is a *services* system (student & registrar services), so the
// LMS-style extras — class activities, private task comments and the Faculty portal — are OFF by default.
// Set ENABLE_LMS=true (and VITE_ENABLE_LMS=true for the website) in a .env file to switch them back on.
export const FEATURES = {
  lms: process.env.ENABLE_LMS === 'true',
}
