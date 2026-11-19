# The Glow Book on the App Store

The iOS project in `ios/` is a Capacitor shell around this web app. The bundle id is `com.theglowbook.app`. To change it, edit that string in all of these together:

- `src/lib/brand.js` (`BUNDLE_ID`)
- `capacitor.config.json` (`appId`)
- `ios/App/App.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`)
- `ios/App/App/Info.plist` (`CFBundleURLSchemes`, used by the magic-link return)

## What this repo already contains

- Capacitor iOS platform
- Camera and barcode scanning plugin (`@capacitor-mlkit/barcode-scanning`)
- App icon and a cream launch background
- `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` in Info.plist
- Safe-area insets in the web shell, and `viewport-fit=cover`
- Magic-link return through `com.theglowbook.app://auth`
- The web manifest, so the same book can still be added to a home screen

## What still needs a person, on a Mac

1. An Apple Developer Program membership for the account that will ship the app.
2. In Xcode, open `ios/App/App.xcworkspace`. Select the App target, set the signing team, and confirm the bundle id.
3. Add the URL scheme `com.theglowbook.app` to the target if a Capacitor upgrade drops the Info.plist entry. The return host is `auth`.
4. In the Supabase dashboard for this project, Authentication → URL configuration, add `com.theglowbook.app://auth` to the redirect allow-list. Without that, the magic link cannot come back into the app. This is a dashboard change, not a database migration.
5. Archive (Product → Archive) and upload with the Organizer, or `xcodebuild -scheme App -archivePath build/App.xcarchive archive` from `ios/App` on a Mac with the signing certificate installed.
6. In App Store Connect, create the app record with bundle id `com.theglowbook.app`.
7. Privacy nutrition labels. Suggested answers from what the app actually does:
   - Contact info: email address, used for the magic link, not shared.
   - Health: cycle dates, only if she turns cycle tracking on, stored in her private account, not used for tracking.
   - Photos: progress photos she attaches to a product, stored in her private storage folder.
   - Identifiers: the account id Supabase assigns.
   - No data is sold, and no data is used for advertising or third-party tracking.
8. Screenshots: 6.7-inch and 6.1-inch iPhone, of Today, the shelf, a product, and sign-in. No placeholder copy.
9. A privacy policy URL. The draft below can be hosted as a page once a URL is chosen.
10. `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in the hosting project's environment, if the written horoscope, concierge, and goal plans should call out. The app works without them and falls back to its own text.
11. The optional storage migration in `supabase/migrations/` if result photos should live in their own bucket. Until it is approved and applied, photos go in the existing private `board` bucket under `{account}/results/`.

## Privacy policy draft

The Glow Book is a private planner. Each book belongs to one account.

We keep the email address you use to sign in, and the planner you write: schedule, notes, cycle information if you turn that on, the products on your shelf, and the photos you attach to them. Photos are files in a private folder named for your account. They are not packed into the planner record.

Sign-in is a link sent to that email. We do not keep a password.

The book is visible to the account that wrote it. Row-level security on the database is what enforces that. We do not sell the book, we do not use it for advertising, and we do not share it with other accounts.

Weather and UV for a city you type are requested from a public forecast. A product barcode may be looked up in a public product database (brand, size, ingredients, and a price when one is listed). Those lookups send the barcode, not your name.

If a written reading or a concierge answer is turned on for the hosted app, the question and the relevant part of your book are sent to the language service configured for the project, in order to write the reply. They are not used to train a public model by us.

You can stop using the book at any time. Signing out leaves the book where it is. Deleting the account, from the privacy room in settings, removes the rows that belong to it.

Questions go to the person who invited you to the book.
