# AMC Attendance — Firebase starter

## Files
- `index.html`: app page and Firebase SDK
- `style.css`: responsive mobile-friendly design
- `config.js`: Firebase Web App config (replace placeholders)
- `app.js`: UI and Firebase Auth/Firestore operations
- `firestore.rules`: database access rules (publish in Firebase Console)

## Setup before use
1. Create a Firebase project at https://console.firebase.google.com/
2. Add a Web App and copy its config into `config.js`. Replace all `PASTE_...` values.
3. Authentication → Sign-in method → enable **Email/Password**.
4. Firestore Database → create database.
5. Open Firestore Rules, paste `firestore.rules`, then Publish.
6. Authentication → Users → add the first admin email/password.
7. Copy the admin user's UID. In Firestore create collection `profiles`, document ID = that exact UID, fields:
   - `name` (string): Admin
   - `email` (string): admin email
   - `role` (string): admin
8. Sign in to the app. Admin can add students/courses/sessions and publish notices.
9. For teacher/student users, create their Authentication account, then create `profiles/{UID}` with `name`, `email`, `role` (`teacher` or `student`). To link a student, set `uid` on the student's `students` document to that Auth UID. Also set `studentUid` on attendance/marks records when needed for student-specific visibility.

## GitHub Pages
Upload `index.html`, `style.css`, `config.js`, `app.js` to the repository root. Publish GitHub Pages from the branch/folder containing `index.html`.

## Security notes
- Never put a Firebase service-account private key or service-role secret in browser files.
- Client-side role checks are for UI only; Firestore Rules are the security boundary.
- Test rules with Firebase Emulator/Rules Playground before using real student records.
- Backup downloads data accessible to the signed-in admin. Keep files private.
- This is a starter implementation; test all workflows with test accounts before production use.
