import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

interface VideoCallProps {
  targetUserId: number;
  targetUserName: string;
  onClose: () => void;
}

export function VideoCall({ targetUserId, targetUserName, onClose }: VideoCallProps) {
  const { user } = useAuth();
  const [callId, setCallId] = useState<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "ringing" | "connected" | "ended">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const icePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const sentIceRef = useRef<Set<string>>(new Set());

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (icePollRef.current) clearInterval(icePollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const endCall = useCallback(async () => {
    if (callId) {
      try {
        await apiRequest("POST", `/api/internal-chat/calls/${callId}/end`);
      } catch {}
    }
    setStatus("ended");
    cleanup();
    setTimeout(onClose, 1000);
  }, [callId, cleanup, onClose]);

  const sendIceCandidate = useCallback(async (candidate: RTCIceCandidate) => {
    if (!callId) return;
    const key = JSON.stringify(candidate.toJSON());
    if (sentIceRef.current.has(key)) return;
    sentIceRef.current.add(key);
    try {
      await apiRequest("POST", `/api/internal-chat/calls/${callId}/ice`, { candidate: candidate.toJSON() });
    } catch {}
  }, [callId]);

  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setStatus("connected");
          durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          endCall();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await apiRequest("POST", "/api/internal-chat/calls/initiate", {
        targetUserId,
        sdp: JSON.stringify(offer),
      });
      const data = await res.json();
      setCallId(data.callId);
      setStatus("ringing");

      pc.onicecandidate = (event) => {
        if (event.candidate && data.callId) {
          const key = JSON.stringify(event.candidate.toJSON());
          if (!sentIceRef.current.has(key)) {
            sentIceRef.current.add(key);
            apiRequest("POST", `/api/internal-chat/calls/${data.callId}/ice`, { candidate: event.candidate.toJSON() }).catch(() => {});
          }
        }
      };

      pollIntervalRef.current = setInterval(async () => {
        try {
          const answerRes = await fetch(`/api/internal-chat/calls/${data.callId}/answer`, { credentials: "include" });
          const answerData = await answerRes.json();
          if (answerData.ended) {
            endCall();
            return;
          }
          if (answerData.answered && answerData.sdp) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            const answer = JSON.parse(answerData.sdp);
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              for (const c of candidateQueueRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              }
              candidateQueueRef.current = [];
            }
          }
        } catch {}
      }, 1000);

      icePollRef.current = setInterval(async () => {
        try {
          const iceRes = await fetch(`/api/internal-chat/calls/${data.callId}/ice`, { credentials: "include" });
          const candidates = await iceRes.json();
          for (const c of candidates) {
            const key = JSON.stringify(c);
            if (!sentIceRef.current.has(key)) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              } else {
                candidateQueueRef.current.push(c);
              }
            }
          }
        } catch {}
      }, 1500);

    } catch (err) {
      console.error("Failed to start call:", err);
      setStatus("ended");
      setTimeout(onClose, 2000);
    }
  }, [targetUserId, endCall, onClose]);

  useEffect(() => {
    startCall();
    return cleanup;
  }, []);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(prev => !prev);
    }
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsCameraOff(prev => !prev);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col" data-testid="video-call-screen">
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          data-testid="video-remote"
        />
        {status !== "connected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white">
            <div className="w-24 h-24 rounded-full bg-[#fb9678] flex items-center justify-center text-3xl font-bold mb-4">
              {(targetUserName?.charAt(0) || "?").toUpperCase()}
            </div>
            <h3 className="text-xl font-semibold mb-2" data-testid="text-call-target">{targetUserName}</h3>
            {status === "connecting" && (
              <p className="text-gray-400 animate-pulse" data-testid="text-call-status">กำลังเชื่อมต่อ...</p>
            )}
            {status === "ringing" && (
              <p className="text-gray-400 animate-pulse" data-testid="text-call-status">กำลังเรียก...</p>
            )}
            {status === "ended" && (
              <p className="text-red-400" data-testid="text-call-status">สิ้นสุดการโทร</p>
            )}
          </div>
        )}

        <div className="absolute top-4 right-4 w-40 h-28 rounded-xl overflow-hidden shadow-xl border-2 border-white/30 bg-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn("w-full h-full object-cover", isCameraOff && "hidden")}
            data-testid="video-local"
          />
          {isCameraOff && (
            <div className="w-full h-full flex items-center justify-center text-white bg-gray-700">
              <VideoOff className="h-8 w-8 opacity-50" />
            </div>
          )}
        </div>

        {status === "connected" && (
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm" data-testid="text-call-duration">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      <div className="bg-gray-900 px-6 py-5 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isMuted ? "bg-red-500 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
          data-testid="btn-toggle-mute"
          title={isMuted ? "เปิดไมค์" : "ปิดไมค์"}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <button
          onClick={toggleCamera}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isCameraOff ? "bg-red-500 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
          data-testid="btn-toggle-camera"
          title={isCameraOff ? "เปิดกล้อง" : "ปิดกล้อง"}
        >
          {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </button>
        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
          data-testid="btn-end-call"
          title="วางสาย"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

interface IncomingCallOverlayProps {
  callId: number;
  callerName: string;
  sdp: string;
  onClose: () => void;
}

export function IncomingCallOverlay({ callId, callerName, sdp, onClose }: IncomingCallOverlayProps) {
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<"ringing" | "connecting" | "connected" | "ended">("ringing");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const icePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentIceRef = useRef<Set<string>>(new Set());
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    if (icePollRef.current) clearInterval(icePollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const endCall = useCallback(async () => {
    try {
      await apiRequest("POST", `/api/internal-chat/calls/${callId}/end`);
    } catch {}
    setStatus("ended");
    cleanup();
    setTimeout(onClose, 1000);
  }, [callId, cleanup, onClose]);

  const decline = useCallback(async () => {
    try {
      await apiRequest("POST", `/api/internal-chat/calls/${callId}/end`);
    } catch {}
    cleanup();
    onClose();
  }, [callId, cleanup, onClose]);

  const acceptCall = useCallback(async () => {
    setAccepted(true);
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setStatus("connected");
          durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          endCall();
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const key = JSON.stringify(event.candidate.toJSON());
          if (!sentIceRef.current.has(key)) {
            sentIceRef.current.add(key);
            apiRequest("POST", `/api/internal-chat/calls/${callId}/ice`, { candidate: event.candidate.toJSON() }).catch(() => {});
          }
        }
      };

      const offer = JSON.parse(sdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      for (const c of candidateQueueRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      candidateQueueRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await apiRequest("POST", `/api/internal-chat/calls/${callId}/answer`, {
        sdp: JSON.stringify(answer),
      });

      icePollRef.current = setInterval(async () => {
        try {
          const iceRes = await fetch(`/api/internal-chat/calls/${callId}/ice`, { credentials: "include" });
          const candidates = await iceRes.json();
          for (const c of candidates) {
            const key = JSON.stringify(c);
            if (!sentIceRef.current.has(key)) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              } else {
                candidateQueueRef.current.push(c);
              }
            }
          }
        } catch {}
      }, 1500);
    } catch (err) {
      console.error("Failed to accept call:", err);
      setStatus("ended");
      setTimeout(onClose, 2000);
    }
  }, [callId, sdp, endCall, onClose]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(prev => !prev);
    }
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsCameraOff(prev => !prev);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (!accepted) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center" data-testid="incoming-call-overlay">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="relative mx-auto w-20 h-20 mb-4">
            <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
            <div className="absolute inset-1 rounded-full bg-green-400/20 animate-ping" style={{ animationDelay: "0.3s" }} />
            <div className="relative w-20 h-20 rounded-full bg-[#fb9678] flex items-center justify-center text-2xl font-bold text-white">
              {(callerName?.charAt(0) || "?").toUpperCase()}
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-1" data-testid="text-caller-name">{callerName}</h3>
          <p className="text-sm text-gray-500 mb-6 animate-pulse">สายเรียกเข้า...</p>
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={decline}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
              data-testid="btn-decline-call"
              title="ปฏิเสธ"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-lg"
              data-testid="btn-accept-call"
              title="รับสาย"
            >
              <Phone className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col" data-testid="video-call-screen">
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          data-testid="video-remote"
        />
        {status !== "connected" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white">
            <div className="w-24 h-24 rounded-full bg-[#fb9678] flex items-center justify-center text-3xl font-bold mb-4">
              {(callerName?.charAt(0) || "?").toUpperCase()}
            </div>
            <h3 className="text-xl font-semibold mb-2">{callerName}</h3>
            {status === "connecting" && (
              <p className="text-gray-400 animate-pulse" data-testid="text-call-status">กำลังเชื่อมต่อ...</p>
            )}
            {status === "ended" && (
              <p className="text-red-400" data-testid="text-call-status">สิ้นสุดการโทร</p>
            )}
          </div>
        )}
        <div className="absolute top-4 right-4 w-40 h-28 rounded-xl overflow-hidden shadow-xl border-2 border-white/30 bg-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn("w-full h-full object-cover", isCameraOff && "hidden")}
            data-testid="video-local"
          />
          {isCameraOff && (
            <div className="w-full h-full flex items-center justify-center text-white bg-gray-700">
              <VideoOff className="h-8 w-8 opacity-50" />
            </div>
          )}
        </div>
        {status === "connected" && (
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm" data-testid="text-call-duration">
            {formatDuration(duration)}
          </div>
        )}
      </div>
      <div className="bg-gray-900 px-6 py-5 flex items-center justify-center gap-6">
        <button
          onClick={toggleMute}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isMuted ? "bg-red-500 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
          data-testid="btn-toggle-mute"
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <button
          onClick={toggleCamera}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isCameraOff ? "bg-red-500 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
          data-testid="btn-toggle-camera"
        >
          {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </button>
        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
          data-testid="btn-end-call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

export function useIncomingCallPoll() {
  const { user } = useAuth();
  const { data: pendingCalls = [] } = useQuery<{ callId: number; callerId: number; callerName: string; sdp: string }[]>({
    queryKey: ["/api/internal-chat/calls/pending"],
    queryFn: () => fetch("/api/internal-chat/calls/pending", { credentials: "include" }).then(r => r.json()),
    enabled: !!(user as any)?.id,
    refetchInterval: 3000,
  });
  return pendingCalls;
}

interface GroupVideoCallProps {
  roomId: number;
  roomName: string;
  onClose: () => void;
}

interface PeerState {
  userId: number;
  fullName: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
}

export function GroupVideoCall({ roomId, roomName, onClose }: GroupVideoCallProps) {
  const { user } = useAuth();
  const [callId, setCallId] = useState<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peers, setPeers] = useState<Map<number, PeerState>>(new Map());
  const [participantNames, setParticipantNames] = useState<Map<number, string>>(new Map());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<number, PeerState>>(new Map());
  const iceQueueRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSignalTsRef = useRef(0);
  const callIdRef = useRef<number | null>(null);

  const cleanupMedia = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peersRef.current.forEach(p => p.pc.close());
    peersRef.current.clear();
    localStreamRef.current = null;
  }, []);

  const serverLeave = useCallback(() => {
    if (callIdRef.current) {
      navigator.sendBeacon(`/api/internal-chat/group-calls/${callIdRef.current}/leave-beacon`);
    }
  }, []);

  const leaveCall = useCallback(async () => {
    if (callIdRef.current) {
      try {
        await apiRequest("POST", `/api/internal-chat/group-calls/${callIdRef.current}/leave`);
      } catch {}
    }
    setStatus("ended");
    cleanupMedia();
    setTimeout(onClose, 1000);
  }, [cleanupMedia, onClose]);

  const createPeerConnection = useCallback((targetUserId: number, targetName: string, isInitiator: boolean) => {
    const stream = localStreamRef.current;
    if (!stream) return null;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        const peerState = peersRef.current.get(targetUserId);
        if (peerState) {
          peerState.stream = event.streams[0];
          peersRef.current.set(targetUserId, { ...peerState });
          setPeers(new Map(peersRef.current));
        }
        const videoEl = remoteVideoRefs.current.get(targetUserId);
        if (videoEl) {
          videoEl.srcObject = event.streams[0];
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && callIdRef.current) {
        apiRequest("POST", `/api/internal-chat/group-calls/${callIdRef.current}/signal`, {
          to: targetUserId,
          type: "ice",
          data: event.candidate.toJSON(),
        }).catch(() => {});
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setStatus("connected");
      }
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        peersRef.current.delete(targetUserId);
        setPeers(new Map(peersRef.current));
        pc.close();
      }
    };

    const peerState: PeerState = { userId: targetUserId, fullName: targetName, pc, stream: null };
    peersRef.current.set(targetUserId, peerState);
    setPeers(new Map(peersRef.current));

    return { pc, peerState };
  }, []);

  const handleSignal = useCallback(async (signal: { from: number; to: number; type: string; data: any }) => {
    const myId = (user as any)?.id;
    if (signal.to !== myId) return;

    if (signal.type === "offer") {
      const fromName = participantNames.get(signal.from) || `User ${signal.from}`;
      let peerState = peersRef.current.get(signal.from);

      if (!peerState) {
        const result = createPeerConnection(signal.from, fromName, false);
        if (!result) return;
        peerState = result.peerState;
      }

      const pc = peerState.pc;
      if (pc.signalingState !== "stable") return;

      await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (callIdRef.current) {
        await apiRequest("POST", `/api/internal-chat/group-calls/${callIdRef.current}/signal`, {
          to: signal.from,
          type: "answer",
          data: answer,
        });
      }
    } else if (signal.type === "answer") {
      const peerState = peersRef.current.get(signal.from);
      if (!peerState) return;
      if (peerState.pc.signalingState === "have-local-offer") {
        await peerState.pc.setRemoteDescription(new RTCSessionDescription(signal.data));
        const queued = iceQueueRef.current.get(signal.from) || [];
        for (const c of queued) {
          try { await peerState.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        iceQueueRef.current.delete(signal.from);
      }
    } else if (signal.type === "ice") {
      const peerState = peersRef.current.get(signal.from);
      if (!peerState) return;
      try {
        if (peerState.pc.remoteDescription) {
          await peerState.pc.addIceCandidate(new RTCIceCandidate(signal.data));
        } else {
          const q = iceQueueRef.current.get(signal.from) || [];
          q.push(signal.data);
          iceQueueRef.current.set(signal.from, q);
        }
      } catch {}
    }
  }, [user, participantNames, createPeerConnection]);

  const handleSignalRef = useRef(handleSignal);
  handleSignalRef.current = handleSignal;

  const startGroupCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const startRes = await apiRequest("POST", "/api/internal-chat/group-calls/start", { roomId });
      const startData = await startRes.json();
      const cId = startData.callId;
      setCallId(cId);
      callIdRef.current = cId;

      const joinRes = await apiRequest("POST", `/api/internal-chat/group-calls/${cId}/join`);
      const joinData = await joinRes.json();

      const nameMap = new Map<number, string>();
      for (const p of joinData.allParticipants || []) {
        nameMap.set(p.userId, p.fullName);
      }
      setParticipantNames(nameMap);

      for (const existingP of joinData.existingParticipants || []) {
        const result = createPeerConnection(existingP.userId, existingP.fullName, true);
        if (result) {
          const offer = await result.pc.createOffer();
          await result.pc.setLocalDescription(offer);
          await apiRequest("POST", `/api/internal-chat/group-calls/${cId}/signal`, {
            to: existingP.userId,
            type: "offer",
            data: offer,
          });
        }
      }

      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/internal-chat/group-calls/${cId}/signals?since=${lastSignalTsRef.current}`, { credentials: "include" });
          const data = await res.json();

          if (data.status === "ended") {
            leaveCall();
            return;
          }

          const updatedNames = new Map<number, string>();
          for (const p of data.participants || []) {
            updatedNames.set(p.userId, p.fullName);
          }
          setParticipantNames(updatedNames);

          const currentParticipantIds = new Set((data.participants || []).map((p: any) => p.userId));
          const myId = (user as any)?.id;
          for (const [pId] of peersRef.current) {
            if (!currentParticipantIds.has(pId)) {
              const ps = peersRef.current.get(pId);
              if (ps) ps.pc.close();
              peersRef.current.delete(pId);
              setPeers(new Map(peersRef.current));
            }
          }

          for (const sig of data.signals || []) {
            if (sig.ts > lastSignalTsRef.current) {
              lastSignalTsRef.current = sig.ts;
            }
            await handleSignalRef.current(sig);
          }
        } catch {}
      }, 1000);

      if (joinData.existingParticipants?.length > 0) {
        setStatus("connected");
      }
    } catch (err) {
      console.error("Failed to start group call:", err);
      setStatus("ended");
      setTimeout(onClose, 2000);
    }
  }, [roomId, user, createPeerConnection, leaveCall, onClose]);

  useEffect(() => {
    startGroupCall();
    return () => {
      serverLeave();
      cleanupMedia();
    };
  }, []);

  useEffect(() => {
    peers.forEach((peerState, userId) => {
      const videoEl = remoteVideoRefs.current.get(userId);
      if (videoEl && peerState.stream && videoEl.srcObject !== peerState.stream) {
        videoEl.srcObject = peerState.stream;
      }
    });
  }, [peers]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(prev => !prev);
    }
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsCameraOff(prev => !prev);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const peerArray = Array.from(peers.values());
  const totalVideos = 1 + peerArray.length;
  const gridCols = totalVideos <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2";
  const gridRows = totalVideos <= 2 ? "grid-rows-1" : "grid-rows-2";

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col" data-testid="group-video-call-screen">
      <div className="bg-gray-800/80 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2 text-white">
          <Video className="h-5 w-5 text-[#fb9678]" />
          <span className="font-semibold text-sm">{roomName}</span>
          <span className="text-xs text-gray-400">({totalVideos} คน)</span>
        </div>
        <div className="flex items-center gap-3">
          {status === "connected" && (
            <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full" data-testid="text-group-call-duration">
              {formatDuration(duration)}
            </span>
          )}
          {status === "connecting" && (
            <span className="text-xs text-yellow-400 animate-pulse">กำลังเชื่อมต่อ...</span>
          )}
        </div>
      </div>

      <div className={`flex-1 grid ${gridCols} ${gridRows} gap-1 p-1 bg-black`}>
        <div className="relative bg-gray-800 rounded-lg overflow-hidden" data-testid="group-video-local">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn("w-full h-full object-cover", isCameraOff && "hidden")}
          />
          {isCameraOff && (
            <div className="w-full h-full flex items-center justify-center text-white bg-gray-700">
              <VideoOff className="h-10 w-10 opacity-50" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
            คุณ {isMuted && <span className="text-red-400 ml-1">🔇</span>}
          </div>
        </div>

        {peerArray.map((peer) => (
          <div key={peer.userId} className="relative bg-gray-800 rounded-lg overflow-hidden" data-testid={`group-video-peer-${peer.userId}`}>
            <video
              ref={(el) => { if (el) remoteVideoRefs.current.set(peer.userId, el); }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!peer.stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-800">
                <div className="w-16 h-16 rounded-full bg-[#fb9678] flex items-center justify-center text-2xl font-bold mb-2">
                  {(peer.fullName?.charAt(0) || "?").toUpperCase()}
                </div>
                <span className="text-sm text-gray-400 animate-pulse">กำลังเชื่อมต่อ...</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
              {peer.fullName}
            </div>
          </div>
        ))}

        {totalVideos < 4 && Array.from({ length: 4 - totalVideos }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-gray-900/50 rounded-lg flex items-center justify-center">
            <span className="text-gray-600 text-xs">ว่าง</span>
          </div>
        )).slice(0, totalVideos <= 2 ? 0 : 4 - totalVideos)}
      </div>

      <div className="bg-gray-900 px-6 py-4 flex items-center justify-center gap-5">
        <button
          onClick={toggleMute}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
            isMuted ? "bg-red-500 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
          data-testid="btn-group-toggle-mute"
          title={isMuted ? "เปิดไมค์" : "ปิดไมค์"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          onClick={toggleCamera}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
            isCameraOff ? "bg-red-500 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
          )}
          data-testid="btn-group-toggle-camera"
          title={isCameraOff ? "เปิดกล้อง" : "ปิดกล้อง"}
        >
          {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>
        <button
          onClick={leaveCall}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors"
          data-testid="btn-group-leave-call"
          title="ออกจากห้อง"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function useActiveGroupCall(roomId: number | null) {
  const { data } = useQuery<{ active: boolean; callId?: number; participants?: any[] }>({
    queryKey: ["/api/internal-chat/group-calls/room", roomId],
    queryFn: () => fetch(`/api/internal-chat/group-calls/room/${roomId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!roomId,
    refetchInterval: 5000,
  });
  return data;
}
