# Manual Test Checklist

Use this checklist for end-to-end LAN file transfer verification on Windows and phone clients.

## One Computer

- [ ] Start the app with the normal development or packaged launch path.
- [ ] Confirm the desktop window opens without startup errors.
- [ ] Confirm every top-level navigation label is Chinese and no first screen is blank.
- [ ] Confirm a mobile URL appears in the desktop UI.
- [ ] Open the mobile URL in a browser on the same computer and confirm the page loads.
- [ ] Request `/api/device` from the local mobile URL and confirm it returns device information.
- [ ] Choose a shared folder from the desktop UI.
- [ ] Confirm the selected shared folder is shown in the app.
- [ ] Confirm the receive folder exists and is writable.
- [ ] Open Shared Files and confirm files and folders show as visible rows or tiles, not only plain text.
- [ ] Open Received Files and confirm files can be opened and shown in File Explorer from inside the app.
- [ ] Confirm Home shows the five most recent received files with Open and Show in Folder actions.
- [ ] Resize the desktop window to 1120x760 and 900x620 and confirm Chinese text, list columns, and grid tiles do not overlap.
- [ ] Confirm empty, loading, error, and populated states are visible for Shared Files and Received Files.

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
- [ ] Drag a file onto a paired device and confirm it sends without using a file picker.
- [ ] Drag a nested folder onto a paired device and confirm nested files arrive with their relative folder structure.
- [ ] Send two files with the same name and confirm the receiver keeps both by adding a conflict suffix such as `(1)`.
- [ ] Browse the peer shared folder inside the desktop app, without opening an external browser.
- [ ] Download a peer shared file and confirm it appears in Received Files and can be opened from there.
- [ ] Confirm a receive-complete Windows notification appears after a successful incoming upload.
- [ ] Click the receive-complete notification and confirm File Explorer opens at the received file.

## Phone

- [ ] Start the desktop app on a Windows computer connected to Wi-Fi or LAN.
- [ ] Scan the QR code from a phone on the same network.
- [ ] Confirm the phone page opens in the mobile browser.
- [ ] Confirm the phone page defaults to Chinese.
- [ ] Complete pairing from the phone when prompted.
- [ ] Upload a photo from the phone.
- [ ] Confirm upload progress or completion is shown.
- [ ] Confirm the uploaded photo appears in the desktop Received Files page and can be opened from inside the app.
- [ ] Browse the shared folder from the phone after pairing.
- [ ] Switch the phone shared browser between list and grid views.
- [ ] Open a subfolder on the phone, then use Back and Refresh.
- [ ] Confirm file size and modified time are visible on phone file rows.
- [ ] Download a file from the shared folder to the phone.
- [ ] Confirm browsing and downloading require pairing before access is allowed.
- [ ] Reject pairing once and confirm the phone shows a clear pairing failure state.
- [ ] Re-pair from the phone and confirm browsing recovers without reloading the QR code manually.

## Failure Cases

- [ ] Block the app through Windows Firewall and confirm discovery, pairing, or transfer failure is reported clearly.
- [ ] Start another process on the app's configured port and confirm port-in-use startup failure is reported clearly.
- [ ] Attempt to browse or download a shared path containing `../` and confirm the request is rejected.
- [ ] Remove, rename, or disconnect the configured shared folder and confirm the app reports the missing folder.
- [ ] Send a large file and confirm transfer progress updates until completion or a clear failure state.
- [ ] Interrupt a large file transfer and confirm partial or failed transfer state is visible.
- [ ] Force a phone shared-list failure and confirm the phone shows a refreshable failure message.
- [ ] Try deleting a received file and confirm the app asks for confirmation before removing it.
- [ ] Confirm remote devices can only browse and download the shared folder, not upload into or delete from it.

## Packaged Build

- [ ] Run `cmd /c npm run dist:win`.
- [ ] Start `dist/LAN File Transfer 0.1.0.exe`.
- [ ] Wait for `/api/device` to respond from the packaged app LAN URL.
- [ ] Confirm the packaged desktop renderer shows the navigation shell, Shared Files, Received Files, peer browsing, and drag-and-drop target.
- [ ] Open `/mobile` from the packaged app LAN URL and confirm the phone browser controls are present.
