"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card" role="alert"><h1>Não foi possível abrir esta página</h1><p>Tente novamente. Se o problema persistir, entre em contato com o suporte.</p><button className="btn btn-primary" onClick={reset}>Tentar novamente</button></section>;
}
