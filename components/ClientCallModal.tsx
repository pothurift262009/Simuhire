import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { decode, decodeAudioData } from '../services/geminiService';
import { MicrophoneIcon, PhoneIcon } from './Icons';

interface ClientCallModalProps {
  jobTitle: string;
  onClose: (transcript: string) => void;
}

const API_KEY = process.env.API_KEY;

export const ClientCallModal: React.FC<ClientCallModalProps> = ({ jobTitle, onClose }) => {
  const [status, setStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [transcript, setTranscript] = useState<{ author: 'Client' | 'You', text: string }[]>([]);
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const endCall = useCallback(() => {
    setStatus('ended');
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
    }
    sessionPromiseRef.current?.then(session => session.close());
    
    const finalTranscript = transcript.map(t => `${t.author}: ${t.text}`).join('\n');
    setTimeout(() => onClose(finalTranscript), 1500);
  }, [transcript, onClose]);


  const startVoiceCall = useCallback(async () => {
    if (!API_KEY) {
        setTranscript(prev => [...prev, { author: 'Client', text: "I'm sorry, my audio system isn't working. Let's reschedule." }]);
        setTimeout(endCall, 3000);
        return;
    }

    setStatus('connected');
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // Based on `js-base64`
    const encode = (bytes: Uint8Array) => {
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    const createBlob = (data: Float32Array): Blob => {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        return {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    };

    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: async () => {
                try {
                    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                    
                    // FIX: Cast window to `any` to allow for `webkitAudioContext` for older browser compatibility.
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                    
                    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
                    scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(audioContextRef.current.destination);

                } catch (err) {
                    console.error('Error accessing microphone:', err);
                    setTranscript(prev => [...prev, { author: 'Client', text: "It seems you're having microphone issues. We can try this again later." }]);
                    setTimeout(endCall, 3000);
                }
            },
            onmessage: async (message: LiveServerMessage) => {
                const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                if (base64EncodedAudioString && outputAudioContextRef.current) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContextRef.current.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContextRef.current, 24000, 1);
                    const source = outputAudioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContextRef.current.destination);
                    source.addEventListener('ended', () => sources.delete(source));
                    source.start(nextStartTime);
                    nextStartTime = nextStartTime + audioBuffer.duration;
                    sources.add(source);
                }

                if (message.serverContent?.outputTranscription) {
                    const text = message.serverContent.outputTranscription.text;
                    currentOutputTranscriptionRef.current += text;
                } else if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    currentInputTranscriptionRef.current += text;
                }

                if (message.serverContent?.turnComplete) {
                    if (currentInputTranscriptionRef.current) {
                        setTranscript(prev => [...prev, { author: 'You', text: currentInputTranscriptionRef.current }]);
                    }
                    if (currentOutputTranscriptionRef.current) {
                         setTranscript(prev => [...prev, { author: 'Client', text: currentOutputTranscriptionRef.current }]);
                    }
                    currentInputTranscriptionRef.current = '';
                    currentOutputTranscriptionRef.current = '';
                }
            },
            onerror: (e: ErrorEvent) => {
                console.error('Live session error:', e);
                setTranscript(prev => [...prev, { author: 'Client', text: "I'm having connection issues. Let's end this call and I'll follow up via email." }]);
                setTimeout(endCall, 3000);
            },
            onclose: (e: CloseEvent) => {
                console.log('Live session closed');
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: `You are a client calling an employee (${jobTitle}) with an urgent, slightly vague, and stressful problem. Be professional but firm. The goal is to test the employee's communication and problem-solving skills under pressure. Start by introducing yourself as "Alex from the Veridian project" and state you have an urgent issue.`,
            outputAudioTranscription: {},
            inputAudioTranscription: {},
        },
    });

  }, [jobTitle, endCall]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 transform transition-all duration-300">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-500 animate-pulse mb-4">
            <PhoneIcon className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-white">Incoming Client Call</h3>
          <p className="text-slate-400 mt-2">Alex - Veridian Project</p>
        </div>

        {status === 'ringing' && (
          <div className="mt-8 flex justify-around">
            <button
              onClick={startVoiceCall}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <MicrophoneIcon className="h-5 w-5" />
              Answer
            </button>
            <button
              onClick={() => onClose('Candidate rejected the call.')}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Decline
            </button>
          </div>
        )}

        {status === 'connected' && (
          <div className="mt-6">
            <div className="h-48 bg-slate-900/50 rounded-lg p-3 overflow-y-auto space-y-3">
              {transcript.map((entry, index) => (
                <div key={index} className={`flex ${entry.author === 'You' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-3 py-2 rounded-lg max-w-[80%] ${entry.author === 'You' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <p className="text-sm">{entry.text}</p>
                  </div>
                </div>
              ))}
               {(currentInputTranscriptionRef.current || currentOutputTranscriptionRef.current) && <div className="text-slate-400 italic">...</div>}
            </div>
            <button
              onClick={endCall}
              className="mt-6 w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              End Call
            </button>
          </div>
        )}

        {status === 'ended' && (
          <div className="mt-6 text-center">
            <p className="text-lg text-slate-300">Call Ended</p>
          </div>
        )}
      </div>
    </div>
  );
};
