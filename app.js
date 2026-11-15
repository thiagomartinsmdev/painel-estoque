/* Painel de Estoque — front-end da API de Estoque (HTML, CSS e JavaScript puro). */
(() => {
  'use strict';

  const LOW = 5;            // mesmo limite de "estoque baixo" da API
  const PAGE = 8;           // produtos por página
  const KEY_URL = 'painel-estoque:url';
  const KEY_DEMO = 'painel-estoque:demo';
  const KEY_FORCE_DEMO = 'painel-estoque:forcedemo';
  const DEFAULT_URL = 'http://127.0.0.1:8000';

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const $ = (sel, root = document) => root.querySelector(sel);

  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  /* ---------- Mensagens de erro da API (FastAPI) ---------- */
  function mensagem(data, status) {
    if (data && typeof data.detail === 'string') return data.detail;
    if (data && Array.isArray(data.detail)) {
      return data.detail.map((d) => {
        const campo = (d.loc || []).slice(1).join('.');
        return campo ? `${campo}: ${d.msg}` : d.msg;
      }).join(' | ');
    }
    return `Erro ${status}`;
  }

  /* ---------- Provedor 1: API real ---------- */
  function apiProvider(base) {
    const req = async (path, { method = 'GET', body } = {}) => {
      let res;
      try {
        res = await fetch(base + path, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch {
        throw new ApiError('Não foi possível falar com a API. Ela está ligada?', 0);
      }
      if (res.status === 204) return null;
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(mensagem(data, res.status), res.status);
      return data;
    };
    const qs = (obj) => {
      const p = new URLSearchParams();
      Object.entries(obj).forEach(([k, v]) => {
        if (v !== '' && v !== false && v != null) p.set(k, v);
      });
      const s = p.toString();
      return s ? `?${s}` : '';
    };
    return {
      demo: false,
      ping: () => req('/'),
      listar: (f) => req('/produtos' + qs({
        busca: f.busca, categoria: f.categoria, baixo_estoque: f.baixo ? 'true' : '',
        skip: f.skip, limit: f.limit,
      })),
      resumo: () => req('/relatorios/resumo'),
      criar: (d) => req('/produtos', { method: 'POST', body: d }),
      atualizar: (id, d) => req(`/produtos/${id}`, { method: 'PATCH', body: d }),
      apagar: (id) => req(`/produtos/${id}`, { method: 'DELETE' }),
      ajustar: (id, q) => req(`/produtos/${id}/estoque`, { method: 'POST', body: { quantidade: q } }),
    };
  }

  /* ---------- Provedor 2: modo demonstração (dados no navegador) ---------- */
  function demoProvider() {
    const seed = [
      ['Camiseta preta', 'roupas', '79.90', 10],
      ['Caneca branca', 'casa', '29.90', 4],
      ['Boné preto', 'roupas', '49.90', 15],
      ['Chaveiro do Galo', 'acessorios', '14.50', 3],
      ['Mochila', 'acessorios', '119.00', 8],
    ];
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY_DEMO)); } catch { db = null; }
    if (!db || !Array.isArray(db.items)) {
      db = { next: seed.length + 1, items: seed.map(([nome, categoria, preco, quantidade], i) => ({ id: i + 1, nome, categoria, preco, quantidade })) };
    }
    const save = () => { try { localStorage.setItem(KEY_DEMO, JSON.stringify(db)); } catch { /* ignora */ } };
    const clone = (p) => ({ ...p, preco: Number(p.preco).toFixed(2) });
    const find = (id) => {
      const p = db.items.find((x) => x.id === id);
      if (!p) throw new ApiError('Produto não encontrado.', 404);
      return p;
    };
    const validar = (d, parcial) => {
      if ((!parcial || d.nome !== undefined) && (typeof d.nome !== 'string' || d.nome.trim().length < 2)) throw new ApiError('nome: precisa ter pelo menos 2 caracteres', 422);
      if ((!parcial || d.preco !== undefined) && !(Number(d.preco) > 0)) throw new ApiError('preco: precisa ser maior que zero', 422);
      if ((!parcial || d.quantidade !== undefined) && !(Number.isInteger(d.quantidade) && d.quantidade >= 0)) throw new ApiError('quantidade: precisa ser um número inteiro maior ou igual a zero', 422);
    };
    return {
      demo: true,
      ping: async () => ({ mensagem: 'demo' }),
      listar: async (f) => {
        let r = db.items.slice().sort((a, b) => a.id - b.id);
        if (f.categoria) r = r.filter((p) => p.categoria === f.categoria);
        if (f.busca) r = r.filter((p) => p.nome.toLowerCase().includes(f.busca.toLowerCase()));
        if (f.baixo) r = r.filter((p) => p.quantidade <= LOW);
        return r.slice(f.skip, f.skip + f.limit).map(clone);
      },
      resumo: async () => {
        const itens = db.items.reduce((s, p) => s + p.quantidade, 0);
        const valor = db.items.reduce((s, p) => s + Number(p.preco) * p.quantidade, 0);
        return {
          total_produtos: db.items.length,
          itens_em_estoque: itens,
          valor_total_estoque: valor.toFixed(2),
          produtos_com_estoque_baixo: db.items.filter((p) => p.quantidade <= LOW).length,
        };
      },
      criar: async (d) => {
        validar(d, false);
        const p = { id: db.next++, nome: d.nome.trim(), categoria: (d.categoria || 'geral').trim() || 'geral', preco: Number(d.preco).toFixed(2), quantidade: d.quantidade };
        db.items.push(p); save(); return clone(p);
      },
      atualizar: async (id, d) => {
        const p = find(id); validar(d, true);
        Object.assign(p, d, d.nome !== undefined ? { nome: d.nome.trim() } : {});
        save(); return clone(p);
      },
      apagar: async (id) => { find(id); db.items = db.items.filter((p) => p.id !== id); save(); return null; },
      ajustar: async (id, q) => {
        const p = find(id);
        if (p.quantidade + q < 0) throw new ApiError(`Estoque insuficiente: há ${p.quantidade} unidade(s) e a saída é de ${Math.abs(q)}.`, 400);
        p.quantidade += q; save(); return clone(p);
      },
    };
  }

  /* ---------- Estado e utilidades de interface ---------- */
  let api = null;
  let hasNext = false;
  const st = { page: 0, busca: '', categoria: '', baixo: false };

  function toast(texto, tipo = 'ok') {
    const t = document.createElement('div');
    t.className = `toast${tipo === 'err' ? ' err' : ''}`;
    t.textContent = texto;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function setStatus(tipo, texto) {
    const el = $('#status');
    el.className = `pill ${tipo}`;
    $('#status-text').textContent = texto;
  }

  const mostrarErro = (id, texto) => { const e = $(id); e.textContent = texto; e.hidden = false; };
  const limparErro = (id) => { const e = $(id); e.textContent = ''; e.hidden = true; };

  /* ---------- Conexão ---------- */
  async function connect() {
    setStatus('', 'Conectando…');
    const url = (localStorage.getItem(KEY_URL) || DEFAULT_URL).replace(/\/+$/, '');
    if (localStorage.getItem(KEY_FORCE_DEMO) !== '1') {
      try {
        const a = apiProvider(url);
        await a.ping();
        api = a;
        setStatus('ok', `API conectada · ${url.replace(/^https?:\/\//, '')}`);
        $('#banner').hidden = true;
        return refresh();
      } catch { /* cai no modo demo */ }
    }
    api = demoProvider();
    setStatus('demo', 'Modo demonstração');
    $('#banner').hidden = false;
    return refresh();
  }

  /* ---------- Carregar e desenhar ---------- */
  async function refresh() {
    try {
      const [lista, resumo, todos] = await Promise.all([
        api.listar({ busca: st.busca, categoria: st.categoria, baixo: st.baixo, skip: st.page * PAGE, limit: PAGE + 1 }),
        api.resumo(),
        api.listar({ busca: '', categoria: '', baixo: false, skip: 0, limit: 200 }),
      ]);
      if (lista.length === 0 && st.page > 0) { st.page -= 1; return refresh(); }
      hasNext = lista.length > PAGE;
      desenharResumo(resumo);
      desenharCategorias(todos);
      desenharTabela(lista.slice(0, PAGE));
      $('#page-info').textContent = `Página ${st.page + 1}`;
      $('#btn-prev').disabled = st.page === 0;
      $('#btn-next').disabled = !hasNext;
    } catch (e) {
      toast(e.message, 'err');
      if (!api.demo) setStatus('off', 'API sem resposta');
    }
  }

  function desenharResumo(r) {
    $('#sum-total').textContent = r.total_produtos;
    $('#sum-itens').textContent = r.itens_em_estoque;
    $('#sum-valor').textContent = brl.format(Number(r.valor_total_estoque));
    $('#sum-baixo').textContent = r.produtos_com_estoque_baixo;
  }

  function desenharCategorias(todos) {
    const cats = [...new Set(todos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (st.categoria && !cats.includes(st.categoria)) cats.push(st.categoria);
    const sel = $('#f-categoria');
    sel.replaceChildren(new Option('Todas', ''), ...cats.map((c) => new Option(c, c)));
    sel.value = st.categoria;
    $('#lista-categorias').replaceChildren(...cats.map((c) => new Option(c, c)));
  }

  function celula(tr, label, conteudo, classe) {
    const td = document.createElement('td');
    td.dataset.label = label;
    if (classe) td.className = classe;
    if (conteudo instanceof Node) td.appendChild(conteudo); else td.textContent = conteudo;
    tr.appendChild(td);
    return td;
  }

  function botao(texto, classe, handler, aria) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = classe; b.textContent = texto;
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', handler);
    return b;
  }

  function desenharTabela(produtos) {
    const tbody = $('#tbody');
    tbody.replaceChildren();
    if (produtos.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6; td.className = 'empty'; td.textContent = 'Nenhum produto encontrado.';
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }
    produtos.forEach((p) => {
      const tr = document.createElement('tr');
      const baixo = p.quantidade <= LOW;
      if (baixo) tr.className = 'low';
      celula(tr, 'ID', String(p.id));
      const nome = celula(tr, 'Produto', p.nome);
      if (baixo) { const b = document.createElement('span'); b.className = 'badge'; b.textContent = 'BAIXO'; nome.appendChild(b); }
      celula(tr, 'Categoria', p.categoria);
      celula(tr, 'Preço', brl.format(Number(p.preco)), 'num');
      celula(tr, 'Estoque', String(p.quantidade), 'num qtd');
      const acoes = document.createElement('span');
      acoes.append(
        botao('Estoque', 'act', () => abrirEstoque(p), `Ajustar estoque de ${p.nome}`),
        botao('Editar', 'act', () => abrirProduto(p), `Editar ${p.nome}`),
        botao('Apagar', 'act del', () => abrirApagar(p), `Apagar ${p.nome}`),
      );
      celula(tr, '', acoes, 'actions');
      tbody.appendChild(tr);
    });
  }

  /* ---------- Produto: criar e editar ---------- */
  function abrirProduto(p) {
    limparErro('#erro-produto');
    $('#dlg-produto-titulo').textContent = p ? 'Editar produto' : 'Novo produto';
    $('#p-id').value = p ? p.id : '';
    $('#p-nome').value = p ? p.nome : '';
    $('#p-categoria').value = p ? p.categoria : '';
    $('#p-preco').value = p ? Number(p.preco).toFixed(2).replace('.', ',') : '';
    $('#p-qtd').value = p ? p.quantidade : 0;
    $('#dlg-produto').showModal();
    $('#p-nome').focus();
  }

  async function salvarProduto(ev) {
    ev.preventDefault();
    limparErro('#erro-produto');
    const nome = $('#p-nome').value.trim();
    const preco = $('#p-preco').value.trim().replace(',', '.');
    const qtdTxt = $('#p-qtd').value.trim();
    const quantidade = Number(qtdTxt);
    if (nome.length < 2) return mostrarErro('#erro-produto', 'Informe o nome (mínimo 2 letras).');
    if (!/^\d+(\.\d{1,2})?$/.test(preco) || Number(preco) <= 0) return mostrarErro('#erro-produto', 'Informe um preço válido maior que zero, como 79,90.');
    if (qtdTxt === '' || !Number.isInteger(quantidade) || quantidade < 0) return mostrarErro('#erro-produto', 'A quantidade deve ser um número inteiro, zero ou maior.');
    const corpo = { nome, categoria: $('#p-categoria').value.trim() || 'geral', preco: Number(preco).toFixed(2), quantidade };
    const id = $('#p-id').value;
    try {
      if (id) await api.atualizar(Number(id), corpo); else await api.criar(corpo);
      $('#dlg-produto').close();
      toast(id ? 'Produto atualizado.' : 'Produto cadastrado.');
      await refresh();
    } catch (e) { mostrarErro('#erro-produto', e.message); }
  }

  /* ---------- Ajuste de estoque ---------- */
  let alvo = null;
  function abrirEstoque(p) {
    alvo = p; limparErro('#erro-estoque');
    $('#estoque-info').textContent = `${p.nome} — estoque atual: ${p.quantidade}`;
    $('#e-qtd').value = '';
    $('#dlg-estoque').showModal();
    $('#e-qtd').focus();
  }
  async function aplicarEstoque(ev) {
    ev.preventDefault(); limparErro('#erro-estoque');
    const txt = $('#e-qtd').value.trim();
    const q = Number(txt);
    if (txt === '' || !Number.isInteger(q) || q === 0) return mostrarErro('#erro-estoque', 'Informe um número inteiro diferente de zero.');
    try {
      await api.ajustar(alvo.id, q);
      $('#dlg-estoque').close();
      toast(q > 0 ? `Entrada de ${q} unidade(s).` : `Saída de ${Math.abs(q)} unidade(s).`);
      await refresh();
    } catch (e) { mostrarErro('#erro-estoque', e.message); }
  }

  /* ---------- Apagar ---------- */
  function abrirApagar(p) {
    alvo = p;
    $('#apagar-info').textContent = `“${p.nome}” será removido do estoque. Essa ação não pode ser desfeita.`;
    $('#dlg-apagar').showModal();
  }
  async function confirmarApagar(ev) {
    ev.preventDefault();
    try {
      await api.apagar(alvo.id);
      $('#dlg-apagar').close();
      toast('Produto apagado.');
      await refresh();
    } catch (e) { $('#dlg-apagar').close(); toast(e.message, 'err'); }
  }

  /* ---------- Configuração da API ---------- */
  function abrirConfig() {
    $('#c-url').value = localStorage.getItem(KEY_URL) || DEFAULT_URL;
    $('#dlg-config').showModal();
  }

  /* ---------- Eventos ---------- */
  let timer;
  $('#f-busca').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { st.busca = e.target.value.trim(); st.page = 0; refresh(); }, 300);
  });
  $('#f-categoria').addEventListener('change', (e) => { st.categoria = e.target.value; st.page = 0; refresh(); });
  $('#f-baixo').addEventListener('change', (e) => { st.baixo = e.target.checked; st.page = 0; refresh(); });
  $('#btn-prev').addEventListener('click', () => { if (st.page > 0) { st.page -= 1; refresh(); } });
  $('#btn-next').addEventListener('click', () => { if (hasNext) { st.page += 1; refresh(); } });
  $('#btn-novo').addEventListener('click', () => abrirProduto(null));
  $('#btn-config').addEventListener('click', abrirConfig);
  $('#btn-retry').addEventListener('click', () => { localStorage.removeItem(KEY_FORCE_DEMO); connect(); });
  $('#form-produto').addEventListener('submit', salvarProduto);
  $('#form-estoque').addEventListener('submit', aplicarEstoque);
  $('#form-apagar').addEventListener('submit', confirmarApagar);
  $('#form-config').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const url = $('#c-url').value.trim();
    if (url) localStorage.setItem(KEY_URL, url);
    localStorage.removeItem(KEY_FORCE_DEMO);
    $('#dlg-config').close();
    connect();
  });
  $('#c-demo').addEventListener('click', () => {
    localStorage.setItem(KEY_FORCE_DEMO, '1');
    $('#dlg-config').close();
    connect();
  });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  connect();
})();
