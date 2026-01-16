-- =============================================
-- ATUALIZAÇÃO: Adicionar valor_rifa em mensalidades
-- Execute no Supabase SQL Editor
-- =============================================

-- 1. Adicionar coluna valor_rifa na tabela mensalidades
ALTER TABLE mensalidades ADD COLUMN IF NOT EXISTS valor_rifa DECIMAL(10,2) DEFAULT 0;

-- 2. Adicionar coluna valor_total (mensalidade + rifa)
ALTER TABLE mensalidades ADD COLUMN IF NOT EXISTS valor_total DECIMAL(10,2) DEFAULT 0;

-- 3. Atualizar registros existentes (valor_total = valor_devido)
UPDATE mensalidades 
SET valor_total = valor_devido, valor_rifa = 0
WHERE valor_total = 0 OR valor_total IS NULL;

-- 4. Criar função para calcular valor_total automaticamente
CREATE OR REPLACE FUNCTION calcular_valor_total_mensalidade()
RETURNS TRIGGER AS $$
BEGIN
  NEW.valor_total := COALESCE(NEW.valor_devido, 0) + COALESCE(NEW.valor_rifa, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para atualizar valor_total
DROP TRIGGER IF EXISTS trigger_calcular_valor_total ON mensalidades;
CREATE TRIGGER trigger_calcular_valor_total
  BEFORE INSERT OR UPDATE ON mensalidades
  FOR EACH ROW
  EXECUTE FUNCTION calcular_valor_total_mensalidade();
