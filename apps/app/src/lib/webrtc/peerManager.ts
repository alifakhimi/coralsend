interface PeerMaps {
  peers: Map<string, RTCPeerConnection>;
  dataChannels: Map<string, RTCDataChannel>;
  pendingIceCandidates: Map<string, RTCIceCandidateInit[]>;
}

export function closePeer(maps: PeerMaps, remoteDeviceId: string): void {
  maps.dataChannels.get(remoteDeviceId)?.close();
  maps.dataChannels.delete(remoteDeviceId);
  maps.peers.get(remoteDeviceId)?.close();
  maps.peers.delete(remoteDeviceId);
  maps.pendingIceCandidates.delete(remoteDeviceId);
}

export function closeAllPeers(maps: PeerMaps): void {
  const deviceIds = new Set([
    ...maps.peers.keys(),
    ...maps.dataChannels.keys(),
    ...maps.pendingIceCandidates.keys(),
  ]);
  deviceIds.forEach((deviceId) => closePeer(maps, deviceId));
}
