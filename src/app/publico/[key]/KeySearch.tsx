"use client";
// Busca manual e leitura por QR Code para chave pública (POC-09): navega para /publico/[chave].
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function extractPublicKey(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/publico\/([^/?#]+)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return trimmed;
}

export function KeySearch({ current }: { current?: string }) {
  const [key, setKey] = useState(current ?? "");
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch(() => undefined);

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    let active = true;
    const timer = window.setInterval(async () => {
      if (!active || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        const value = codes.find((c) => c.rawValue)?.rawValue;
        if (value) {
          const extracted = extractPublicKey(value);
          if (extracted) {
            active = false;
            stopCamera();
            setKey(extracted);
            router.push(`/publico/${encodeURIComponent(extracted)}`);
          }
        }
      } catch {
        // Aguarda próximo frame válido.
      }
    }, 350);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cameraOpen, router]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setQrStatus(null);
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setQrStatus("Seu navegador não suporta leitura automática de QR Code. Use a câmera do celular ou digite a chave pública.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const detector = new Detector({ formats: ["qr_code"] });
        const codes = await detector.detect(bitmap);
        const value = codes.find((c) => c.rawValue)?.rawValue;
        if (!value) {
          setQrStatus("Nenhum QR Code encontrado na imagem selecionada.");
          return;
        }
        const extracted = extractPublicKey(value);
        if (!extracted) {
          setQrStatus("O QR Code lido não contém uma chave pública válida.");
          return;
        }
        setKey(extracted);
        router.push(`/publico/${encodeURIComponent(extracted)}`);
      } finally {
        bitmap.close();
      }
    } catch {
      setQrStatus("Não foi possível ler o QR Code da imagem. Tente outra imagem ou digite a chave pública.");
    }
  }

  async function openCamera() {
    setQrStatus(null);
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setQrStatus("Leitura pela câmera indisponível neste navegador. Use a opção de imagem do QR Code ou digite a chave pública.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setQrStatus("Não foi possível acessar a câmera. Permita o uso da câmera ou selecione uma imagem de QR Code.");
    }
  }

  return (
    <div className="form" style={{ maxWidth: "100%" }}>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) router.push(`/publico/${encodeURIComponent(key.trim())}`);
        }}
      >
        <input
          style={{ flex: 2 }}
          placeholder="digite a chave pública"
          aria-label="Chave pública para consulta"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Consultar
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Ler QR Code (imagem)
        </button>
        <button type="button" className="btn" onClick={cameraOpen ? stopCamera : openCamera}>
          {cameraOpen ? "Fechar câmera" : "Ler pela câmera"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Selecionar imagem com QR Code"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </form>
      {cameraOpen && (
        <div>
          <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 360, borderRadius: 4, border: "1px solid var(--line)" }} />
          <p className="muted">Aponte a câmera para o QR Code do protocolo.</p>
        </div>
      )}
      {qrStatus && (
        <p className="alert alert-warn" role="status">
          {qrStatus}
        </p>
      )}
    </div>
  );
}
