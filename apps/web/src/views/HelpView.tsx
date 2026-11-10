export function HelpView() {
  return (
    <section className="help-view">
      <div className="page-intro page-panel">
        <span className="card-eyebrow">Ajuda e suporte</span>
        <h2>Como interpretar o RastreiaWeb</h2>
        <p>O relatório automatiza verificações objetivas, mas não substitui revisão humana, testes de usabilidade ou uma auditoria completa de acessibilidade.</p>
      </div>

      <div className="help-grid">
        <article className="page-panel">
          <span>01</span>
          <h3>Informe uma página autorizada</h3>
          <p>Use apenas páginas públicas que você possui ou tem autorização para testar.</p>
        </article>
        <article className="page-panel">
          <span>02</span>
          <h3>Aguarde a análise controlada</h3>
          <p>A API valida DNS e redirecionamentos antes de acessar cada destino.</p>
        </article>
        <article className="page-panel">
          <span>03</span>
          <h3>Revise as ocorrências</h3>
          <p>Erros do teste HEAD são confirmados com GET. Só 404 ou 410 confirmados entram como links quebrados.</p>
        </article>
        <article className="page-panel">
          <span>04</span>
          <h3>Confirme manualmente</h3>
          <p>Use o elemento HTML e a sugestão como ponto de partida para investigar cada problema.</p>
        </article>
      </div>

      <div className="page-panel limitations">
        <h3>Limitações atuais</h3>
        <ul>
          <li>Apenas uma página é analisada por vez.</li>
          <li>O histórico permanece no navegador e ainda não possui conta ou banco de dados.</li>
          <li>Responsividade e regras completas do axe-core entrarão nas próximas versões.</li>
          <li>Sites que bloqueiam requisições automatizadas podem retornar resultados inconclusivos.</li>
          <li>Respostas 401, 403 e 429 são inconclusivas e devem ser confirmadas manualmente.</li>
        </ul>
      </div>
    </section>
  );
}
