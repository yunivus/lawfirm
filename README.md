# LexCounsel

LexCounsel is a static web client backed by Firebase Authentication, Firestore, and Storage.

## First-time Firebase setup

The repository is already connected to Firebase project `law-firm-management-syst-6c874` through [js/firebase-config.js](js/firebase-config.js). Complete these steps in the Firebase Console before testing registration:

1. Open https://console.firebase.google.com/ and select `law-firm-management-syst-6c874`.
2. Open **Build > Authentication > Sign-in method**.
3. Select **Email/Password**, turn on **Enable**, and click **Save**. This fixes `auth/operation-not-allowed`.
4. Open **Build > Firestore Database** and create or select the **default** database.
5. Open **Project settings > Your apps** and confirm the Web app configuration matches [firebase-applet-config.json](firebase-applet-config.json).
6. In **Authentication > Settings > Authorized domains**, add the domain where the app will run. `localhost` is normally already present.

## Run locally

Install Node.js, open PowerShell in this folder, and run:

```powershell
npm install
npm start
```

Open http://localhost:3000/register.html. Do not open the HTML file directly with `file://`; browser module and Firebase requests should run through the local server.

## Deploy with Firebase CLI

Install the Firebase CLI once:

```powershell
npm install -g firebase-tools
firebase login
firebase use law-firm-management-syst-6c874
firebase deploy --only firestore:rules,hosting
```

The repository includes [firebase.json](firebase.json), [.firebaserc](.firebaserc), and [firestore.rules](firestore.rules) for this deployment.

After changing [firestore.rules](firestore.rules), deploy the rules before testing registration. If `firebase` is not recognized in PowerShell, run the deployment from the Firebase Console: open **Firestore Database > Rules**, replace the rules with the contents of [firestore.rules](firestore.rules), click **Publish**, and then retry registration.

## Roles

Public registration creates a `client` account only. The dashboard is selected from the authenticated user's Firestore profile. Admin and lawyer profiles should be created and assigned by a trusted administrator; public users must not be allowed to choose those roles.
