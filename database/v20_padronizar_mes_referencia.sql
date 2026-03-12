-- =============================================
-- V20 - PADRONIZAÇÃO DO MES_REFERENCIA
-- Formato padrão: YYYY-MM (ex: 2026-01, 2026-02)
-- =============================================

-- 1. MENSALIDADES
-- Converter de "MM/YYYY" para "YYYY-MM"
UPDATE mensalidades 
SET mes_referencia = 
  SUBSTRING(mes_referencia FROM 4 FOR 4) || '-' || SUBSTRING(mes_referencia FROM 1 FOR 2)
WHERE mes_referencia LIKE '__/____';

-- 2. COMPROVANTES
-- Converter de "MM/YYYY" para "YYYY-MM"
UPDATE comprovantes 
SET mes_referencia = 
  SUBSTRING(mes_referencia FROM 4 FOR 4) || '-' || SUBSTRING(mes_referencia FROM 1 FOR 2)
WHERE mes_referencia LIKE '__/____';

-- 3. JUROS_ATRASO
-- Converter de "MM/YYYY" para "YYYY-MM"
UPDATE juros_atraso 
SET mes_referencia = 
  SUBSTRING(mes_referencia FROM 4 FOR 4) || '-' || SUBSTRING(mes_referencia FROM 1 FOR 2)
WHERE mes_referencia LIKE '__/____';

-- 4. JUROS_EMPRESTIMO
-- Converter de "MM/YYYY" para "YYYY-MM"
UPDATE juros_emprestimo 
SET mes_referencia = 
  SUBSTRING(mes_referencia FROM 4 FOR 4) || '-' || SUBSTRING(mes_referencia FROM 1 FOR 2)
WHERE mes_referencia LIKE '__/____';

-- 5. RIFA_SORTEIOS
-- Converter de "MM/YYYY" para "YYYY-MM"
UPDATE rifa_sorteios 
SET mes_referencia = 
  SUBSTRING(mes_referencia FROM 4 FOR 4) || '-' || SUBSTRING(mes_referencia FROM 1 FOR 2)
WHERE mes_referencia LIKE '__/____';

-- 6. CDI (se tiver mes_referencia)
UPDATE cdi 
SET mes_referencia = 
  SUBSTRING(mes_referencia FROM 4 FOR 4) || '-' || SUBSTRING(mes_referencia FROM 1 FOR 2)
WHERE mes_referencia LIKE '__/____';

-- =============================================
-- VERIFICAÇÃO
-- =============================================
-- Execute para verificar se ficou tudo no formato correto:

-- SELECT DISTINCT mes_referencia FROM mensalidades ORDER BY mes_referencia;
-- SELECT DISTINCT mes_referencia FROM comprovantes WHERE mes_referencia IS NOT NULL ORDER BY mes_referencia;
-- SELECT DISTINCT mes_referencia FROM juros_atraso WHERE mes_referencia IS NOT NULL ORDER BY mes_referencia;
-- SELECT DISTINCT mes_referencia FROM juros_emprestimo WHERE mes_referencia IS NOT NULL ORDER BY mes_referencia;
-- SELECT DISTINCT mes_referencia FROM rifa_sorteios ORDER BY mes_referencia;
