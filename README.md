# AMC Economics Attendance — GitHub Pages + Firebase

## What is included
- Responsive Bengali UI based on the supplied design; dark mode
- Firebase email/password login for admin, teacher and student
- Role-based profiles stored in Firestore
- Student attendance using a four-digit PIN for an active session; duplicate attendance is blocked by a deterministic document ID
- Admin profile linking, student list, sessions, courses, notices, manual attendance, marks, reports/CSV and JSON backup/restore
- PWA manifest and service worker

## Important limitations / security notes
- This is a static web app. Never put a Firebase Admin SDK private key or service-account JSON in these files.
- Firebase Web config is public by design; Firestore Security Rules protect data. Review and test the rules before real use.
- Create each person's Firebase Authentication account in Firebase Console first. The app's Admin panel links an Auth UID to a role/profile; it does not create Auth users.
- A four-digit PIN is weak. Share it only for the active class and close the session afterward. For high-stakes attendance, use stronger student identity verification and preferably a trusted backend/Cloud Function.
- This starter has not been tested against your live Firebase project. Configure and test with dummy accounts/data before using real student records.
- Do not import old localStorage records automatically; export and review any old data separately.

## Setup
1. Create a Firebase project at https://console.firebase.google.com/.
2. In Authentication → Sign-in method, enable **Email/Password**.
3. In Authentication → Users, create an initial admin user with email/password. Create teacher/student accounts too, or later as needed.
4. In Project settings → General → Your apps, add a Web app and copy its Firebase config into `config.js`, replacing every placeholder.
5. In Firestore Database, create a database.
6. In Firestore Rules, paste `firestore.rules` and publish.
7. In Firestore Data, create collection `profiles`. Add a document whose document ID is the initial admin user's **exact Auth UID**, with fields:
   - `name` (string): admin's name
   - `role` (string): `admin`
   - `email` (string): admin email
8. In your GitHub repository root, upload/replace all files from this folder: `index.html`, `style.css`, `config.js`, `app.js`, `manifest.json`, `sw.js`, `firestore.rules`, `README.md`.
9. In GitHub repository Settings → Pages, publish from the `main` branch and `/(root)` folder. Open the Pages URL after deployment.
10. Sign in as admin. For each teacher/student, create their Firebase Auth user in Authentication → Users, copy their UID, then use the app's Admin panel to add a profile. For a student, fill roll and session.
11. Create a session with a four-digit attendance PIN and set it active. A student logs in with their own Firebase Auth email/password and submits the session PIN.
12. Test with one fake student and one fake teacher before entering real records.

## Firestore profile roles
- `admin`
- `teacher`
- `student`

## Notes
- If Firestore reports a missing index, follow the Firebase Console link in the error to create it. Most simple queries in this app do not require a composite index.
- For student attendance and marks, each record must contain `studentUid` equal to the student's Firebase Auth UID.
- GitHub Pages is static hosting; it does not run a private backend.

### PIN privacy
- Session PINs are stored separately in `sessionPins`, which only admin/teacher roles can read. Students can read session metadata but not PIN documents.
- Attendance writes are checked by Firestore Rules against the active session and the PIN attempt. The PIN attempt is stored in the attendance record for the rules check; only staff and the matching student can read that record. For stronger privacy, use a trusted Cloud Function to validate the PIN and omit it from stored records.
