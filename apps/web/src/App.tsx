import { FormEvent, useState } from 'react';

export function App() {
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('A conexão segura com a auditoria será implementada na próxima etapa.');
  }

  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">Auditoria web com contexto</span>
        <h1 id="hero-title">Encontre problemas antes que seus usuários encontrem.</h1>
        <p className="introduction">
          O RastreiaWeb reunirá diagnósticos de links, recursos, responsividade e
          acessibilidade em um relatório claro e acionável.
        </p>

        <form className="audit-form" onSubmit={handleSubmit}>
          <label htmlFor="website-url">URL pública autorizada</label>
          <div className="field-row">
            <input
              id="website-url"
              name="website-url"
              type="url"
              placeholder="https://exemplo.com.br"
              required
            />
            <button type="submit">Analisar página</button>
          </div>
          <p className="form-hint">
            Use somente páginas públicas que você tem autorização para testar.
          </p>
          {message && <p className="status-message" role="status">{message}</p>}
        </form>
      </section>

      <section className="features" aria-labelledby="features-title">
        <div>
          <span className="eyebrow">Fundação v0.1</span>
          <h2 id="features-title">Uma visão técnica sem perder a clareza.</h2>
        </div>
        <ul>
          <li>
            <strong>Links e recursos</strong>
            <span>Status HTTP, origem do problema e redirecionamentos.</span>
          </li>
          <li>
            <strong>Responsividade</strong>
            <span>Problemas mensuráveis em diferentes tamanhos de tela.</span>
          </li>
          <li>
            <strong>Acessibilidade</strong>
            <span>Verificações automáticas com contexto e limitações explícitas.</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
