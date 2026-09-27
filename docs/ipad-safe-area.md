# iPad status-bar layout

The web viewport now uses `viewport-fit=cover`. `src/safeArea.css` reserves the
reported safe-area insets outside the app's density-dependent header padding.
Sticky playback/assessment controls include the top inset; a fixed surface
behind the system status bar prevents scrolling text showing through it.
Dialogs and bottom setup actions also respect the available area. Header groups
can wrap when an iPad window or translated labels need more space.

Capacitor explicitly uses `ios.contentInset: 'never'`: CSS owns the inset so
native scroll-view adjustment does not apply it a second time.

Verification performed on Windows: 272 existing functional tests, production
build, lint (existing MobileInstallPrompt warning), and `cap copy ios`. The
copied iOS HTML and CSS contain the viewport and safe-area rules. No connected
browser or physical iPad was available for visual verification in this run.

Manual layout fixture: with Vite running, open
`/tests/fixtures/safe-area.html`. Its selector simulates inset geometry only;
it is not included in the production build and does not emulate WebKit.
Check portrait/landscape, all three interface densities, normal scrolling,
focused reading, and a settings dialog. Real-device validation must additionally
check actual system insets and rotations in iPadOS/WKWebView.

The installed TestFlight binary does not update when local web files change.
On the Mac, transfer the updated source, run `npm ci`, `npm run build` and
`npx cap sync ios`, then archive/upload a new build in Xcode and install that
build through TestFlight. No archive, upload, commit or push was performed here.
