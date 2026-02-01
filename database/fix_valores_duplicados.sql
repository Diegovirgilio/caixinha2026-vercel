-- =============================================
-- CORREÇÃO: Valores duplicados nas mensalidades
-- Execute no Supabase SQL Editor
-- =============================================
-- PREMISSA: Todos com comprovante aprovado e rifa selecionada pagaram o valor integral

-- 1. Primeiro, vamos ver a situação atual (opcional - para diagnóstico)
-- SELECT 
--   m.id,
--   m.mes_referencia,
--   c.nome,
--   c.cotas,
--   c.participa_rifa,
--   m.valor_devido,
--   CASE WHEN c.participa_rifa THEN m.valor_devido + (c.cotas * 20) ELSE m.valor_devido END as valor_total_correto,
--   m.valor_pago as valor_pago_atual,
--   m.status
-- FROM mensalidades m
-- JOIN cotistas c ON c.id = m.cotista_id
-- WHERE m.status = 'pago'
-- ORDER BY c.nome, m.mes_referencia;

-- 2. Atualizar valor_pago para o valor correto (valor_devido + rifa se participar)
-- Para mensalidades com status 'pago', definir valor_pago = valor total correto
UPDATE mensalidades m
SET 
  valor_pago = (
    SELECT 
      CASE 
        WHEN c.participa_rifa THEN m.valor_devido + (c.cotas * 20)
        ELSE m.valor_devido
      END
    FROM cotistas c
    WHERE c.id = m.cotista_id
  )
WHERE m.status = 'pago';

-- 3. Recalcular status para todas as mensalidades baseado no valor correto
UPDATE mensalidades m
SET status = (
  SELECT 
    CASE 
      WHEN m.valor_pago >= (
        CASE 
          WHEN c.participa_rifa THEN m.valor_devido + (c.cotas * 20)
          ELSE m.valor_devido
        END
      ) THEN 'pago'
      WHEN m.valor_pago > 0 THEN 'parcial'
      ELSE 'pendente'
    END
  FROM cotistas c
  WHERE c.id = m.cotista_id
);

-- 4. Verificar resultado (opcional)
-- SELECT 
--   m.id,
--   m.mes_referencia,
--   c.nome,
--   c.cotas,
--   c.participa_rifa,
--   m.valor_devido,
--   CASE WHEN c.participa_rifa THEN m.valor_devido + (c.cotas * 20) ELSE m.valor_devido END as valor_total,
--   m.valor_pago,
--   m.status
-- FROM mensalidades m
-- JOIN cotistas c ON c.id = m.cotista_id
-- ORDER BY c.nome, m.mes_referencia;
