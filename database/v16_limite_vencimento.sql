-- =============================================
-- V16 - LIMITE INDIVIDUAL E VENCIMENTO DE EMPRÉSTIMO
-- =============================================

-- 1. Adicionar limite de empréstimo individual por cotista (padrão 80%)
ALTER TABLE cotistas ADD COLUMN IF NOT EXISTS limite_emprestimo INTEGER DEFAULT 80;

-- 2. Adicionar data de vencimento nos empréstimos
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 3. Atualizar empréstimos existentes com vencimento (1 mês após criação)
UPDATE emprestimos 
SET data_vencimento = (created_at + INTERVAL '1 month')::DATE
WHERE data_vencimento IS NULL AND status IN ('pendente', 'ativo');

-- 4. Atualizar cotistas existentes com limite padrão
UPDATE cotistas 
SET limite_emprestimo = 80 
WHERE limite_emprestimo IS NULL;
