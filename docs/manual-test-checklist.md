# Manual Test Checklist

Use this checklist for end-to-end LAN file transfer verification on Windows and phone clients.

## One Computer

- [ ] Start the app with the normal development or packaged launch path.
- [ ] Confirm the desktop window opens without startup errors.
- [ ] Confirm a mobile URL appears in the desktop UI.
- [ ] Open the mobile URL in a browser on the same computer and confirm the page loads.
- [ ] Request `/api/device` from the local mobile URL and confirm it returns device information.
- [ ] Choose a shared folder from the desktop UI.
- [ ] Confirm the selected shared folder is shown in the app.
- [ ] Confirm the receive folder exists and is writable.

## Two Windows Computers

- [ ] Connect both Windows computers to the same LAN.
- [ ] Start the app on both computers.
- [ ] Confirm each computer discovers the other nearby device.
- [ ] Start pairing from one computer.
- [ ] Confirm the pairing prompt appears on the target computer.
- [ ] Accept the pairing request and confirm both devices show as paired or trusted.
- [ ] Send a file from one computer to the other.
- [ ] Confirm transfer progress is shown during the send.
- [ ] Confirm the received file appears in the receiver's receive folder.
- [ ] Send another file between the same devices.
- [ ] Confirm no repeated pairing prompt appears for the trusted device.
- [ ] Remove the trusted device from one computer.
- [ ] Attempt to send or browse again and confirm pairing is required again.
- [ ] Pair the devices again successfully after removal.

## Phone

- [ ] Start the desktop app on a Windows computer connected to Wi-Fi or LAN.
- [ ] Scan the QR code from a phone on the same network.
- [ ] Confirm the phone page opens in the mobile browser.
- [ ] Complete pairing from the phone when prompted.
- [ ] Upload a photo from the phone.
- [ ] Confirm upload progress or completion is shown.
- [ ] Confirm the uploaded photo appears in the desktop receive folder.
- [ ] Browse the shared folder from the phone after pairing.
- [ ] Download a file from the shared folder to the phone.
- [ ] Confirm browsing and downloading require pairing before access is allowed.

## Failure Cases

- [ ] Block the app through Windows Firewall and confirm discovery, pairing, or transfer failure is reported clearly.
- [ ] Start another process on the app's configured port and confirm port-in-use startup failure is reported clearly.
- [ ] Attempt to browse or download a shared path containing `../` and confirm the request is rejected.
- [ ] Remove, rename, or disconnect the configured shared folder and confirm the app reports the missing folder.
- [ ] Send a large file and confirm transfer progress updates until completion or a clear failure state.
- [ ] Interrupt a large file transfer and confirm partial or failed transfer state is visible.
