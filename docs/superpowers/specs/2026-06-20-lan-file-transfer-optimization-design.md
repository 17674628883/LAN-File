# LAN File Transfer Optimization Design

## Goal

Upgrade the current Windows LAN file-transfer application from a functional prototype into a dependable daily-use product. The optimized product must make shared and received files visually understandable, keep transfers reliable across network interruptions, protect local-network traffic, and integrate cleanly with Windows.

## Delivery Strategy

Use phased delivery instead of a full rewrite. Each phase must produce a usable, testable release:

1. File browsing and daily transfer experience.
2. Resumable transfer engine.
3. Verified pairing and encrypted sessions.
4. Windows integration and production distribution.

This order gives users immediate usability improvements while isolating the higher-risk protocol and security changes.

## Product Navigation

The desktop application uses a compact Windows 11 File Explorer-inspired layout with fixed left navigation:

- Home: local status, nearby devices, quick send, and recently received files.
- Devices: online state, pairing state, shared-file browsing, and trust removal.
- Transfers: queued, active, paused, reconnecting, completed, and failed tasks.
- Shared Files: local read-only shared root and its contents.
- Received Files: files received from phones and computers, with direct open actions.
- Settings: device name, receive path, tray behavior, startup, security, and bandwidth.

The interface defaults to a dense list suitable for repeated work. Shared Files and Received Files can switch to a thumbnail grid for images and videos.

## Component Boundaries

### Device Discovery

Advertises the local device, discovers peers, tracks online state, and emits stable peer records. It does not own pairing or transfer state.

### Pairing And Security

Owns device identity, six-digit verification, trusted-device records, key exchange, session authentication, trust revocation, and security events.

### Transfer Engine

Owns manifests, chunk state, progress, speed, remaining-time estimates, pause, resume, cancellation, retry, integrity checks, and reconnect behavior.

### File Library

Owns the read-only shared root, received-file index, safe path resolution, metadata, thumbnails, file-name conflicts, and opening local files or directories.

### Windows Integration

Owns tray behavior, system notifications, optional startup, firewall guidance, installer metadata, signing, and updates.

The renderer communicates with these modules through typed IPC contracts. UI components do not construct protocol requests directly.

## File Browser Experience

List view displays:

- File or folder icon.
- Name.
- Size.
- Type.
- Modified time.

Grid view displays thumbnails for supported images and videos and standard icons for other file types.

Both desktop and mobile experiences support:

- Entering folders.
- Returning to the parent folder.
- Breadcrumb navigation.
- Refreshing.
- Searching the current source.
- Downloading files.

Desktop local views also support double-click open, open containing folder, properties, forwarding, and safe deletion from Received Files. Remote Shared Files remain read-only: remote users cannot upload, rename, move, or delete shared content.

## Sending And Receiving

Files and folders can be sent by drag-and-drop onto a device or through explicit send buttons. Before starting, the UI shows the destination, file count, and total size.

Paired devices are accepted automatically. Incoming content is always written under the configured Received Files directory, never into Shared Files. Completion notifications provide Open File and Open Folder actions.

Name conflicts preserve both copies using suffixes such as `Photo (1).jpg`. Existing files are never silently overwritten.

## Resumable Transfer Protocol

1. The sender submits a manifest containing relative paths, sizes, chunk layout, and integrity metadata.
2. The receiver validates paths and available disk space, then returns the chunks it already has.
3. The sender transfers only missing chunks.
4. The receiver writes to temporary files and validates each chunk while receiving.
5. After full-file verification, the receiver atomically renames the temporary file to its final conflict-safe name.
6. Interrupted tasks enter a reconnecting state and resume when the peer returns.
7. Abandoned partial tasks expire after a defined retention period and are cleaned automatically.

The transfer view shows bytes transferred, total size, current speed, estimated remaining time, and clear task state. Actions include pause, continue, cancel, and retry.

## Pairing And Encryption

First-time pairing follows this flow:

1. The initiating device sends a pairing request.
2. Both devices display the same six-digit verification code and device identity details.
3. The receiver confirms only after comparing the code.
4. Devices exchange and store identity public keys.
5. Later sessions authenticate automatically until trust is revoked.

All control messages and file bytes use encrypted sessions. Each connection uses an ephemeral session key; long-term device keys authenticate the exchange rather than encrypting files directly.

Security rules:

- Unpaired devices cannot upload, browse, or download.
- Shared paths cannot escape the selected shared root.
- Upload paths cannot specify absolute destinations on the receiver.
- Revoked devices must complete verification again.
- Logs record device, time, action, and result, but never file contents or secret material.

## Error Handling

Every user-facing failure provides a reason and a next action:

- Device unavailable: check network, peer application, and firewall.
- Pairing rejected, mismatched, or timed out: show the specific state and allow retry.
- Insufficient disk space: report required and available space before transfer.
- File busy: wait and retry, or choose a conflict-safe destination.
- Network interruption: show Waiting for reconnect and resume automatically.
- Missing shared root: disable remote browsing and offer Reselect Folder.
- Firewall blocked: show the active port and a Windows repair path.
- Integrity failure: remove invalid temporary output and retry affected chunks.

Diagnostics can be exported without exposing file contents, access tokens, or cryptographic keys.

## Windows Integration

Closing the main window minimizes the application to the system tray. Discovery and receiving continue in the background.

The tray shows online state and active task count. Its menu contains:

- Open Main Window.
- Pause Receiving.
- Open Received Files.
- Exit Completely.

Windows startup is disabled by default and can be enabled in Settings. Production distribution includes an application icon, installer and uninstaller metadata, version information, code signing, and signed automatic updates. A failed update must leave the installed version usable.

## Delivery Phases

### Phase 1: Daily Usability

- File Explorer-style layout.
- List and thumbnail views.
- Shared Files and Received Files browsers.
- Drag-and-drop and multi-file sending.
- Original file-name preservation and conflict-safe naming.
- Completion notifications and direct open actions.

Acceptance: phones and Windows peers can clearly browse, send, receive, download, and open files without locating folders manually.

### Phase 2: Reliable Transfer Engine

- Chunked transfer manifests.
- Pause, continue, retry, and cancellation.
- Automatic reconnection and resume.
- Speed and remaining-time calculation.
- Disk-space preflight and integrity verification.

Acceptance: an interrupted large transfer resumes without retransmitting completed chunks and produces a verified identical file.

### Phase 3: Security Upgrade

- Six-digit verification pairing.
- Device identity keys.
- Authenticated encrypted sessions.
- Trust revocation and security events.
- Enforced read-only sharing and isolated receive destinations.

Acceptance: unpaired access is rejected, trusted sessions authenticate correctly, and captured network traffic does not reveal file contents.

### Phase 4: Production Release

- Tray and Windows notifications.
- Optional startup.
- Installer, icon, version metadata, and uninstall support.
- Code signing and signed automatic updates.
- Crash reporting and sanitized diagnostics export.

Acceptance: installation, background operation, update, rollback-on-failure, and uninstall work on supported Windows versions.

## Testing Strategy

Automated coverage includes:

- Discovery state transitions.
- Pairing verification and trust revocation.
- Session authentication and encryption boundaries.
- Manifest negotiation and chunk resume.
- Integrity verification and partial-file cleanup.
- Conflict-safe file naming.
- Shared-root path traversal prevention.
- Received-directory write isolation.
- Typed IPC contracts.
- Mobile shared browsing and upload flows.

Manual matrices include:

- Two Windows computers.
- Android and iPhone browsers.
- Small files, multi-gigabyte files, nested folders, and Chinese file names.
- Wi-Fi interruption, peer restart, firewall block, disk exhaustion, and name conflicts.
- Desktop and mobile visual checks for blank pages, overlap, overflow, and responsive behavior.

Each phase must pass its automated suite and relevant physical-device matrix before packaging a user-facing build.

## Explicit Non-Goals

- Public internet relay or cloud storage.
- User accounts or subscription billing.
- Native Android or iOS applications.
- Remote modification of Shared Files.
- Silent overwrite of existing received files.
