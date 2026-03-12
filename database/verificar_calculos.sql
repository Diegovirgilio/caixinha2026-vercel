-- =============================================
-- SQL PARA VERIFICAR CÁLCULOS FINANCEIROS
-- Dashboard e Relatório - Caixinha 2026
-- =============================================

-- 1. IDENTIFICAR ADMINS (para excluir dos cálculos)
-- =============================================
SELECT 'ADMINS' as tipo, id, nome 
FROM cotistas 
WHERE is_admin = true;

-- 2. RESUMO GERAL DE COTISTAS
-- =============================================
SELECT 
  'COTISTAS' as categoria,
  COUNT(*) FILTER (WHERE NOT is_admin AND status = 'ativo') as total_cotistas,
  SUM(cotas) FILTER (WHERE NOT is_admin AND status = 'ativo') as total_cotas
FROM cotistas;

-- 3. MENSALIDADES (excluindo admins)
-- =============================================
SELECT 
  'MENSALIDADES' as categoria,
  SUM(valor_devido) as total_esperado,
  SUM(valor_pago) as total_recebido,
  SUM(valor_devido) - SUM(valor_pago) as total_pendente,
  SUM(COALESCE(valor_rifa, 0)) as total_rifa_esperado,
  SUM(CASE WHEN status IN ('pago', 'parcial') THEN COALESCE(valor_rifa, 0) ELSE 0 END) as rifas_pagas
FROM mensalidades m
WHERE NOT EXISTS (
  SELECT 1 FROM cotistas c 
  WHERE c.id = m.cotista_id AND c.is_admin = true
);

-- 4. EMPRÉSTIMOS (excluindo admins)
-- =============================================
SELECT 
  'EMPRESTIMOS' as categoria,
  -- Ativos
  COUNT(*) FILTER (WHERE status = 'ativo') as qtd_ativos,
  SUM(valor_emprestimo) FILTER (WHERE status = 'ativo') as principal_ativos,
  SUM(valor_total) FILTER (WHERE status = 'ativo') as total_com_juros_ativos,
  -- Pagos
  COUNT(*) FILTER (WHERE status = 'pago') as qtd_pagos,
  SUM(valor_total) FILTER (WHERE status = 'pago') as total_quitado,
  SUM(valor_juros) FILTER (WHERE status = 'pago') as juros_recebidos,
  -- Pendentes
  COUNT(*) FILTER (WHERE status = 'pendente') as qtd_pendentes
FROM emprestimos e
WHERE NOT EXISTS (
  SELECT 1 FROM cotistas c 
  WHERE c.id = e.cotista_id AND c.is_admin = true
);

-- 5. JUROS DE ATRASO
-- =============================================
SELECT 
  'JUROS_ATRASO' as categoria,
  COUNT(*) as quantidade,
  SUM(valor_juros) as total_juros_atraso
FROM juros_atraso;

-- 6. JUROS DE EMPRÉSTIMO (tabela juros_emprestimo)
-- =============================================
SELECT 
  'JUROS_EMPRESTIMO' as categoria,
  COUNT(*) as quantidade,
  SUM(valor_juros) as total_juros,
  SUM(valor_principal_abatido) as total_principal_abatido
FROM juros_emprestimo;

-- 7. CDI ACUMULADO
-- =============================================
SELECT 
  'CDI' as categoria,
  COUNT(*) as quantidade,
  SUM(valor) as total_cdi
FROM cdi;

-- 8. RIFAS / SORTEIOS
-- =============================================
SELECT 
  'RIFA_SORTEIOS' as categoria,
  COUNT(*) as sorteios_realizados,
  SUM(COALESCE(valor_premio, 0)) as premios_pagos
FROM rifa_sorteios;

-- 9. CÁLCULO DO SALDO (FÓRMULA COMPLETA)
-- =============================================
WITH calculos AS (
  SELECT
    -- Mensalidades pagas (excluindo admins)
    (SELECT COALESCE(SUM(valor_pago), 0) 
     FROM mensalidades m 
     WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true)
    ) as mensalidades_pagas,
    
    -- Rifas pagas (excluindo admins)
    (SELECT COALESCE(SUM(CASE WHEN status IN ('pago', 'parcial') THEN COALESCE(valor_rifa, 0) ELSE 0 END), 0)
     FROM mensalidades m 
     WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true)
    ) as rifas_pagas,
    
    -- JUROS de empréstimos quitados (excluindo admins) - NÃO o valor total!
    (SELECT COALESCE(SUM(valor_juros), 0) 
     FROM emprestimos e 
     WHERE e.status = 'pago'
     AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true)
    ) as juros_emprestimos_recebidos,
    
    -- Juros de atraso
    (SELECT COALESCE(SUM(valor_juros), 0) FROM juros_atraso) as juros_atraso,
    
    -- CDI acumulado
    (SELECT COALESCE(SUM(valor), 0) FROM cdi) as cdi_acumulado,
    
    -- Empréstimos ativos - PRINCIPAL (excluindo admins)
    (SELECT COALESCE(SUM(valor_emprestimo), 0) 
     FROM emprestimos e 
     WHERE e.status = 'ativo'
     AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true)
    ) as emprestimos_ativos,
    
    -- Prêmios de rifa pagos
    (SELECT COALESCE(SUM(valor_premio), 0) FROM rifa_sorteios) as premios_rifa
)
SELECT 
  '=== CÁLCULO DO SALDO ===' as titulo,
  'ENTRADAS (+)' as secao,
  mensalidades_pagas as "Mensalidades Pagas",
  rifas_pagas as "Rifas Pagas",
  juros_emprestimos_recebidos as "Juros Empréstimos",
  juros_atraso as "Juros de Atraso",
  cdi_acumulado as "CDI Acumulado",
  (mensalidades_pagas + rifas_pagas + juros_emprestimos_recebidos + juros_atraso + cdi_acumulado) as "TOTAL ENTRADAS"
FROM calculos;

SELECT 
  'SAÍDAS (-)' as secao,
  emprestimos_ativos as "Empréstimos Ativos (Principal)",
  premios_rifa as "Prêmios Rifa Pagos",
  (emprestimos_ativos + premios_rifa) as "TOTAL SAÍDAS"
FROM (
  SELECT
    (SELECT COALESCE(SUM(valor_emprestimo), 0) 
     FROM emprestimos e 
     WHERE e.status = 'ativo'
     AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true)
    ) as emprestimos_ativos,
    (SELECT COALESCE(SUM(valor_premio), 0) FROM rifa_sorteios) as premios_rifa
) x;

-- 10. SALDO FINAL
-- =============================================
SELECT 
  '>>> SALDO FINAL <<<' as titulo,
  (
    -- ENTRADAS
    (SELECT COALESCE(SUM(valor_pago), 0) FROM mensalidades m WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true))
    + (SELECT COALESCE(SUM(CASE WHEN status IN ('pago', 'parcial') THEN COALESCE(valor_rifa, 0) ELSE 0 END), 0) FROM mensalidades m WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true))
    + (SELECT COALESCE(SUM(valor_juros), 0) FROM emprestimos e WHERE e.status = 'pago' AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true))
    + (SELECT COALESCE(SUM(valor_juros), 0) FROM juros_atraso)
    + (SELECT COALESCE(SUM(valor), 0) FROM cdi)
    -- SAÍDAS
    - (SELECT COALESCE(SUM(valor_emprestimo), 0) FROM emprestimos e WHERE e.status = 'ativo' AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true))
    - (SELECT COALESCE(SUM(valor_premio), 0) FROM rifa_sorteios)
  ) as saldo_em_conta;

-- 11. COMPARATIVO DASHBOARD vs RELATÓRIO
-- =============================================
SELECT 
  '=== VALORES PARA CONFERÊNCIA ===' as titulo;

SELECT 'Total Esperado (mensalidades)' as metrica,
  (SELECT SUM(valor_devido) FROM mensalidades m WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true)) as valor;

SELECT 'Total Recebido (mensalidades)' as metrica,
  (SELECT SUM(valor_pago) FROM mensalidades m WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true)) as valor;

SELECT 'Pendente (mensalidades)' as metrica,
  (SELECT SUM(valor_devido) - SUM(valor_pago) FROM mensalidades m WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true)) as valor;

SELECT 'Empréstimos Ativos (principal)' as metrica,
  (SELECT SUM(valor_emprestimo) FROM emprestimos e WHERE e.status = 'ativo' AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true)) as valor;

SELECT 'Juros Recebidos (empréstimos pagos)' as metrica,
  (SELECT SUM(valor_juros) FROM emprestimos e WHERE e.status = 'pago' AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true)) as valor;

SELECT 'CDI Acumulado' as metrica,
  (SELECT COALESCE(SUM(valor), 0) FROM cdi) as valor;

SELECT 'SALDO FINAL' as metrica,
  (
    (SELECT COALESCE(SUM(valor_pago), 0) FROM mensalidades m WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true))
    + (SELECT COALESCE(SUM(CASE WHEN status IN ('pago', 'parcial') THEN COALESCE(valor_rifa, 0) ELSE 0 END), 0) FROM mensalidades m WHERE NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = m.cotista_id AND c.is_admin = true))
    + (SELECT COALESCE(SUM(valor_juros), 0) FROM emprestimos e WHERE e.status = 'pago' AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true))
    + (SELECT COALESCE(SUM(valor_juros), 0) FROM juros_atraso)
    + (SELECT COALESCE(SUM(valor), 0) FROM cdi)
    - (SELECT COALESCE(SUM(valor_emprestimo), 0) FROM emprestimos e WHERE e.status = 'ativo' AND NOT EXISTS (SELECT 1 FROM cotistas c WHERE c.id = e.cotista_id AND c.is_admin = true))
    - (SELECT COALESCE(SUM(valor_premio), 0) FROM rifa_sorteios)
  ) as valor;
