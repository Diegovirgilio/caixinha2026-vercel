-- =============================================
-- V16 - LIMITE INDIVIDUAL E VENCIMENTO DE EMPRÉSTIMO
-- =============================================

-- 1. Adicionar limite de empréstimo individual por cotista (padrão 80%)
ALTER TABLE cotistas ADD COLUMN IF NOT EXISTS limite_emprestimo INTEGER DEFAULT 80;

-- 2. Adicionar limite de empréstimo CAIXINHA individual (padrão 100%)
ALTER TABLE cotistas ADD COLUMN IF NOT EXISTS limite_emprestimo_caixinha INTEGER DEFAULT 100;

-- 3. Adicionar data de vencimento nos empréstimos
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 4. Adicionar modalidade de empréstimo (normal ou caixinha)
-- normal = 60% tomador + 40% proporcional
-- caixinha = 100% proporcional às cotas
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS modalidade VARCHAR(20) DEFAULT 'normal';

-- 5. Atualizar empréstimos existentes com vencimento (1 mês após criação)
UPDATE emprestimos 
SET data_vencimento = (created_at + INTERVAL '1 month')::DATE
WHERE data_vencimento IS NULL AND status IN ('pendente', 'ativo');

-- 6. Atualizar cotistas existentes com limite padrão
UPDATE cotistas 
SET limite_emprestimo = 80 
WHERE limite_emprestimo IS NULL;

-- 7. Atualizar cotistas existentes com limite caixinha padrão
UPDATE cotistas 
SET limite_emprestimo_caixinha = 100 
WHERE limite_emprestimo_caixinha IS NULL;

-- 8. Atualizar empréstimos existentes com modalidade padrão
UPDATE emprestimos 
SET modalidade = 'normal' 
WHERE modalidade IS NULL;
