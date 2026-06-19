# LAN File Transfer Design

## Goal

Build a Windows desktop app for transferring files across devices on the same local network. The first version supports Windows-to-Windows transfer through a desktop app, and phone participation through a browser page opened by scanning a QR code.

## Scope

Included in version 1:

- Windows desktop app built with Electron.
- Automatic discovery of other Windows desktop app instances on the same LAN.
- First-time pairing confirmation, with trusted devices remembered afterward.
- File and folder sending between paired computers.
- A user-selected shared folder that paired devices can browse and download from.
- A mobile web page for phones to upload files to the computer and download shared files.
- Transfer progress, cancellation, failure display, and retry.

Excluded from version 1:

- Public internet transfer.
- Account login or cloud sync.
- Native Android or iOS apps.
- Resumable transfers.
- Advanced permission groups.
- Sharing the whole computer by default.

## Product Shape

The app is a normal Windows Electron desktop application. It contains the desktop UI, a local HTTP/WebSocket service, and a LAN discovery layer.

The desktop UI manages:

- Nearby device list.
- Pairing confirmation prompts.
- Sending files and folders.
- Transfer progress.
- Shared folder selection.
- QR code display for mobile access.
- Trusted device management.

The local service manages:

- File upload and download endpoints.
- Shared folder browsing endpoints.
- WebSocket events for transfer status and pairing requests.
- The mobile browser page.

The discovery layer manages:

- Advertising this computer on the local network.
- Finding other app instances on the same network.
- Exchanging basic device metadata such as device name, device ID, service address, and pairing state.

## Main Screens

### Nearby Devices

Shows Windows computers running the app on the same LAN.

Device states:

- Unpaired.
- Waiting for confirmation.
- Paired.
- Offline.

Primary actions:

- Send file.
- Send folder.
- Open shared folder.
- Remove trusted device.

### Transfers

Shows active and completed send/receive tasks.

Each task shows:

- File or folder name.
- Direction.
- Size.
- Progress.
- Speed.
- Status.

Supported actions:

- Cancel active transfer.
- Retry failed transfer.
- Open received file location.

### Shared Folder

Lets the user choose one local folder as the shared root.

Behavior:

- No folder is shared by default.
- Only paired devices can browse or download files.
- All requested paths are validated against the shared root.
- If the folder is removed or unavailable, the app prompts the user to choose a new folder.

### Mobile QR

Shows a QR code and LAN URL for phones.

The phone browser page supports:

- Uploading files to the computer.
- Browsing the computer's shared folder after pairing.
- Downloading shared files.

The first phone visit triggers a pairing confirmation prompt on the desktop app.

## Core Flows

### Windows-to-Windows Pairing

1. Computer A and Computer B both open the app.
2. Each device discovers the other through LAN discovery.
3. Computer A sends a file to Computer B or tries to browse B's shared folder.
4. Computer B shows a pairing confirmation prompt.
5. If the user accepts, B stores A as a trusted device and allows the action.
6. Future actions from A to B do not need repeated confirmation unless trust is removed.

### Phone Pairing

1. The desktop app shows a QR code.
2. The phone scans the QR code and opens the LAN web page.
3. The phone identifies itself as a new device.
4. The desktop app shows a pairing confirmation prompt.
5. If the user accepts, the phone can upload files and browse/download shared files.

### Shared Folder Access

1. The user selects a shared folder on the desktop app.
2. A paired computer or phone requests the folder listing.
3. The local service validates the requested path.
4. The remote device can browse and download files inside the shared root only.

## Transfer Protocol

LAN discovery uses UDP or mDNS-style local discovery. After discovery, devices communicate through the local HTTP/WebSocket service.

File transfer uses HTTP upload/download with chunked or streamed transfer so large files do not need to be loaded fully into memory. The UI tracks progress, speed, completion, cancellation, and failure.

Version 1 does not implement resumable transfers. If a transfer fails, the user can retry from the beginning.

Folders are supported by preserving directory structure. Implementation may either upload files individually with relative paths or package the folder before transfer, depending on which path is more reliable during development.

## Security Model

Each desktop app instance generates a local device ID and local secret on first launch. These are stored on the user's computer.

Trusted device records include:

- Device ID.
- Display name.
- Device type.
- Trust timestamp.
- Last seen timestamp.

Rules:

- Unpaired devices cannot send files or browse shared folders without confirmation.
- Paired devices are trusted until removed.
- Mobile browsers are treated as devices and must pair before access.
- Shared folder access is limited to the selected root directory.
- Shared folder is disabled until the user explicitly chooses a folder.

## Error Handling

Device not found:

- Tell the user to check that both devices are on the same network, both apps are open, and firewall access is allowed.

Port unavailable:

- Try another port automatically when possible.
- Show the current LAN URL after selecting the active port.

Firewall blocked:

- Show a clear prompt explaining that Windows Firewall may need to allow local network access.

Transfer failed:

- Show the failed state, reason when available, and a retry action.

File name conflict:

- Save with an automatic suffix such as `Photo (1).jpg`.

Insufficient space:

- Check available disk space before transfer when possible.
- If the transfer still fails, show a clear error.

Shared folder unavailable:

- Disable remote browsing and prompt the user to choose a valid folder.

Invalid path request:

- Reject the request and log it as a security-related event.

## Testing Plan

Core tests:

- Two Windows computers can discover each other on the same LAN.
- Unpaired devices trigger pairing confirmation.
- Paired devices can send files.
- Paired devices can browse and download from the shared folder.
- Removing a trusted device forces pairing again.
- Phone QR page opens on the same LAN.
- Phone upload works after pairing.
- Phone shared-folder download works after pairing.
- Transfer progress is accurate enough for normal use.
- Cancel and retry work.
- File name conflicts are handled safely.
- Path traversal attempts cannot escape the shared folder.

Manual environment tests:

- Windows Firewall allowed.
- Windows Firewall blocked.
- Devices on different networks.
- Port already in use.
- Shared folder removed after selection.
- Large file transfer.
- Folder transfer with nested files.

## Open Implementation Choices

These can be decided during implementation without changing the product design:

- Exact discovery library or protocol.
- Whether folder transfer is streamed file-by-file or packaged first.
- Exact storage format for trusted devices.
- Exact UI styling.

