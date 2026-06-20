export interface PairingPeer {
  deviceId: string;
  name: string;
  host: string;
  port: number;
}

export interface LocalPairingIdentity {
  deviceId: string;
  displayName: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PairingResult {
  paired: boolean;
  accessToken?: string;
}

export async function requestPeerPairing(
  peer: PairingPeer,
  identity: LocalPairingIdentity,
  fetchImpl: FetchLike = fetch
): Promise<PairingResult> {
  const response = await fetchImpl(createPairingUrl(peer), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      deviceId: identity.deviceId,
      displayName: identity.displayName,
      deviceType: "desktop"
    })
  });

  if (response.status === 403) {
    return { paired: false };
  }

  if (!response.ok) {
    throw new Error(`Pairing request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as { paired?: boolean; accessToken?: string };
  return {
    paired: body.paired === true,
    accessToken: body.accessToken
  };
}

function createPairingUrl(peer: PairingPeer): string {
  const host = peer.host.includes(":") && !peer.host.startsWith("[") ? `[${peer.host}]` : peer.host;
  return new URL("/api/pair", `http://${host}:${peer.port}`).toString();
}
