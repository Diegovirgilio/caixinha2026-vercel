-- =============================================
-- CAIXINHA 2026 - ATUALIZAÇÃO V4
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. FIX: TRIGGER DE EXCLUSÃO EM CASCATA
-- Mudando de BEFORE para AFTER DELETE
-- =============================================

DROP TRIGGER IF EXISTS on_cotista_delete ON cotistas;

CREATE TRIGGER on_cotista_delete
    AFTER DELETE ON cotistas
    FOR EACH ROW
    EXECUTE FUNCTION delete_auth_user_on_cotista_delete();

-- =============================================
-- 2. ADICIONAR COLUNA TELEFONE NA TABELA COTISTAS
-- =============================================

ALTER TABLE cotistas ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

-- Criar índice para busca por telefone
CREATE INDEX IF NOT EXISTS idx_cotistas_telefone ON cotistas(telefone);

-- =============================================
-- 3. VERIFICAÇÃO
-- =============================================

SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'cotistas' 
AND column_name = 'telefone';
