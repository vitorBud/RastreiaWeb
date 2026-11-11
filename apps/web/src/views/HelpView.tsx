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
          <h3>Revise ocorrências e links</h3>
          <p>Em “Todos os links”, veja cada elemento na ordem da página. Erros do teste HEAD são confirmados com GET; só 404 ou 410 confirmados entram como quebrados.</p>
        </article>
        <article className="page-panel">
          <span>04</span>
          <h3>Confirme manualmente</h3>
          <p>Em imagens sem alt, confira a URL, a página de origem e o HTML. Use alt vazio somente quando a imagem for decorativa.</p>
        </article>
      </div>

      <div className="page-panel limitations">
        <h3>Limitações atuais</h3>
        <ul>
          <li>Apenas uma página é analisada por vez.</li>
          <li>O histórico permanece no navegador e ainda não possui conta ou banco de dados.</li>
          <li>A responsividade mede overflow horizontal e elementos fora da viewport em desktop, tablet e celular.</li>
          <li>O relatório informa a largura testada, o excesso em pixels e o elemento HTML relacionado.</li>
          <li>A análise não identifica sozinha todos os problemas visuais; sobreposições e legibilidade ainda exigem revisão manual.</li>
          <li>A verificação de acessibilidade atual é focada em imagens sem alt, com URL, página de origem e HTML detalhados.</li>
          <li>Contraste, teclado, leitores de tela, semântica e compreensão do conteúdo ainda precisam de avaliação manual.</li>
          <li>Sites que bloqueiam requisições automatizadas podem retornar resultados inconclusivos.</li>
          <li>Respostas 401, 403 e 429 são inconclusivas e devem ser confirmadas manualmente.</li>
          <li>Todos os links do HTML estático são listados, mas somente a quantidade configurada de destinos HTTP únicos recebe requisições.</li>
          <li>Imagens em CSS, inseridas por JavaScript ou sem atributo src ainda ficam fora da verificação inicial.</li>
        </ul>
      </div>
    </section>
  );
}
