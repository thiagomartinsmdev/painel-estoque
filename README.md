# 🖥️ Painel de Estoque

Painel web para a [API de Estoque](https://github.com/thiagomartinsmdev/estoque-api): cadastre, edite, apague e ajuste o estoque dos produtos, com resumo e alertas de estoque baixo. Feito com **HTML, CSS e JavaScript puro**, sem bibliotecas.

![Painel de Estoque](docs/painel.png)

## Funcionalidades

- Resumo do estoque: total de produtos, itens, valor em estoque e alertas
- Lista de produtos com busca por nome, filtro por categoria, filtro de estoque baixo e paginação
- Cadastro e edição de produtos, com validação dos campos
- Entrada e saída de estoque (a API bloqueia estoque negativo e o painel mostra o motivo)
- Exclusão com confirmação
- **Modo demonstração:** sem a API, o painel usa dados de exemplo guardados no navegador, então dá para testar online
- Layout responsivo (celular e computador), acessível e com tema escuro

## Tecnologias

HTML5 · CSS3 · JavaScript (ES2020) · Fetch API · API REST (FastAPI + PostgreSQL)

## Como rodar com a API

1. Suba a API de Estoque, que precisa estar com CORS habilitado (veja abaixo):

```bash
uvicorn app.main:app --reload
```

2. Abra a pasta do painel no VS Code e rode com a extensão **Live Server** (botão *Go Live*), ou pelo terminal:

```bash
python -m http.server 5500
```

3. Acesse **http://127.0.0.1:5500** e confira o selo verde **API conectada** no topo.

Se a API estiver em outro endereço, clique em **Configurar API** e informe a URL.

### CORS na API

Como o painel e a API ficam em endereços diferentes, a API precisa permitir o acesso do navegador. No `app/main.py` da API de Estoque:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # em produção, liste só os endereços permitidos
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Modo demonstração

Se a API não for encontrada, aparece o aviso amarelo e o painel passa a usar dados de exemplo salvos no `localStorage` do navegador. Nada é enviado para a internet. Clique em **Tentar conectar de novo** quando a API estiver ligada.

## Estrutura

```
index.html       # página e janelas (dialogs)
css/style.css    # visual (tema escuro, responsivo)
js/app.js        # lógica: API, modo demo, tabela, formulários
```

## Próximos passos

- [ ] Login (depois de adicionar JWT na API)
- [ ] Gráfico de estoque por categoria
- [ ] Exportar a lista para CSV

---

Feito por **Thiago Matosinhos** · [GitHub](https://github.com/thiagomartinsmdev) · [LinkedIn](https://www.linkedin.com/in/thiago-filipe-b08586325/)
