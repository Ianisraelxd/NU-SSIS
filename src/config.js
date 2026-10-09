// Feature switches (build-time). The project is a services system, so the LMS-style extras
// (class activities, private task comments, Faculty portal) are off unless VITE_ENABLE_LMS=true.
export const FEATURES = {
  lms: import.meta.env.VITE_ENABLE_LMS === 'true',
}
