# Universal iPhone and iPad support

Both iOS app build configurations now target device families `1,2`. The existing
iPhone portrait/landscape orientations and all four iPad orientations are retained,
as are the bundle identifier, microphone consent text and iOS deployment target.

The existing narrow-screen limit of eight measures remains in place for new
phone exercises; wider displays retain the 4, 8, 12 and 16 measure choices. The
engraving engine uses one measure per row on narrow displays, with horizontal
scrolling when dense notation needs more space. No music-generation or playback
rules are changed.

The existing four-sided CSS safe area also covers phone notches and the home
indicator. Capacitor SystemBars' injected `--safe-area-inset-*` values are used
where supplied (including Android), with a fallback to CSS `env()` values. Phone
navigation and saved-score actions can wrap. In short landscape
viewports, playback and assessment controls scroll with the page rather than
covering most of the score. Dialog content remains scrollable inside its safe area.

`tests/ios-phone-support.test.mjs` checks both native target configurations,
orientation/microphone declarations, and the existing eight-measure phone limit
versus longer tablet exercises in single-staff and both grand-staff modes.
`tests/fixtures/safe-area.html` adds an iPhone landscape profile with simulated
left/right and bottom insets. This fixture tests geometry only, not WebKit.

Native archive/signing, App Store availability and real-device verification are
separate release steps. On physical iPhone and iPad, verify portrait/landscape,
playback after app resume, microphone permission and capture, score scrolling and
dialogs around actual system insets. A browser viewport check does not establish
that those native behaviors have passed.
