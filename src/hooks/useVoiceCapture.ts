/**
 * Push-to-talk dictation, using the recogniser the browser already has.
 *
 * Why this and not a model of our own: a bundled speech model would be tens of
 * megabytes, would have to be downloaded before the first use at a bedside, and
 * would not be usable on the phones this app is for. The browser's recogniser
 * costs nothing to ship and is available where it matters.
 *
 * What it costs instead is honesty. Chrome and Safari both send the audio to
 * their vendor's servers to transcribe it; this is **not** on-device
 * recognition, and the app says so before the microphone is ever opened. That
 * is also why there is no ambient mode: recognition starts when the learner
 * presses a button and stops when they press it again, and the recogniser holds
 * the microphone only for that interval.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceState = 'unsupported' | 'idle' | 'recording' | 'transcribing' | 'ready' | 'failed'

interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [i: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => SpeechRecognitionLike

function recogniser(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Whether dictation can work at all in this browser. Checked at runtime. */
export function voiceSupported(): boolean {
  return recogniser() !== null
}

export interface VoiceCapture {
  state: VoiceState
  /** Seconds held so far, for the recording indicator. */
  elapsed: number
  /** Final text plus whatever is still being recognised. */
  transcript: string
  error: string
  start: () => void
  stop: () => void
  reset: () => void
}

export function useVoiceCapture(): VoiceCapture {
  const [state, setState] = useState<VoiceState>(voiceSupported() ? 'idle' : 'unsupported')
  const [elapsed, setElapsed] = useState(0)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<SpeechRecognitionLike | null>(null)
  const stopping = useRef(false)

  /** Releases the microphone. Called on stop, on failure, and on unmount. */
  const release = useCallback(() => {
    const r = ref.current
    ref.current = null
    if (!r) return
    r.onresult = null
    r.onerror = null
    r.onend = null
    try {
      r.abort()
    } catch {
      // Already stopped; nothing holds the microphone either way.
    }
  }, [])

  useEffect(() => release, [release])

  useEffect(() => {
    if (state !== 'recording') return
    const started = Date.now()
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500)
    return () => window.clearInterval(timer)
  }, [state])

  const start = useCallback(() => {
    const Ctor = recogniser()
    if (!Ctor) {
      setState('unsupported')
      return
    }
    release()
    setError('')
    setFinalText('')
    setInterim('')
    stopping.current = false

    const r = new Ctor()
    r.lang = 'vi-VN'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (e) => {
      let done = ''
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const res = e.results[i]
        if (res.isFinal) done += res[0].transcript
        else pending += res[0].transcript
      }
      // Nothing is logged here, deliberately: a transcript is clinical content
      // and the console is a place it would outlive the session.
      if (done) setFinalText((prev) => (prev ? `${prev} ${done.trim()}` : done.trim()))
      setInterim(pending)
    }

    r.onerror = (e) => {
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Trình duyệt chưa được cấp quyền dùng micro.'
          : e.error === 'no-speech'
            ? 'Không nghe thấy gì. Thử lại và nói gần micro hơn.'
            : e.error === 'network'
              ? 'Không kết nối được dịch vụ chuyển giọng nói thành văn bản.'
              : 'Không ghi âm được. Bạn có thể gõ thay vì nói.',
      )
      release()
      setState('failed')
    }

    r.onend = () => {
      release()
      // A recogniser can also end on its own after a pause. Either way the work
      // is kept and the learner can edit it or record again — except after a
      // failure, whose message must survive.
      setState((prev) => (prev === 'failed' ? 'failed' : 'ready'))
    }

    try {
      r.start()
      ref.current = r
      setState('recording')
    } catch {
      release()
      setError('Không mở được micro.')
      setState('failed')
    }
  }, [release])

  const stop = useCallback(() => {
    stopping.current = true
    const r = ref.current
    if (!r) {
      setState((prev) => (prev === 'recording' ? 'ready' : prev))
      return
    }
    setState('transcribing')
    try {
      r.stop()
    } catch {
      release()
      setState('ready')
    }
  }, [release])

  const reset = useCallback(() => {
    release()
    setFinalText('')
    setInterim('')
    setError('')
    setElapsed(0)
    setState(voiceSupported() ? 'idle' : 'unsupported')
  }, [release])

  return {
    state,
    elapsed,
    transcript: [finalText, interim].filter(Boolean).join(' ').trim(),
    error,
    start,
    stop,
    reset,
  }
}
