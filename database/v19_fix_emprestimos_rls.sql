-- =============================================
-- V19 - CORREÇÃO DE RLS PARA EMPRÉSTIMOS
-- =============================================

-- Verificar se a tabela emprestimos tem RLS habilitado
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas que podem estar conflitando
DROP POLICY IF EXISTS "Emprestimos: Admin pode tudo" ON emprestimos;
DROP POLICY IF EXISTS "Emprestimos: Cotista vê próprios" ON emprestimos;
DROP POLICY IF EXISTS "Emprestimos: Cotista pode solicitar" ON emprestimos;
DROP POLICY IF EXISTS "emprestimos_select_policy" ON emprestimos;
DROP POLICY IF EXISTS "emprestimos_insert_policy" ON emprestimos;
DROP POLICY IF EXISTS "emprestimos_update_policy" ON emprestimos;

-- Criar política de SELECT: todos autenticados podem ver
CREATE POLICY "emprestimos_select_all" ON emprestimos
    FOR SELECT USING (auth.role() = 'authenticated');

-- Criar política de INSERT: cotistas podem solicitar empréstimo
CREATE POLICY "emprestimos_insert_cotista" ON emprestimos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Criar política de UPDATE: admin pode atualizar qualquer empréstimo
CREATE POLICY "emprestimos_update_admin" ON emprestimos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Criar política de DELETE: apenas admin
CREATE POLICY "emprestimos_delete_admin" ON emprestimos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM cotistas 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Verificar se a coluna principal_restante existe
ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS principal_restante DECIMAL(10,2);

-- Atualizar empréstimos que não tem principal_restante
UPDATE emprestimos 
SET principal_restante = valor_emprestimo 
WHERE principal_restante IS NULL AND status IN ('pendente', 'ativo');

-- Para empréstimos já pagos, zerar principal_restante
UPDATE emprestimos 
SET principal_restante = 0 
WHERE status = 'pago' AND (principal_restante IS NULL OR principal_restante > 0);

-- Garantir que status está correto
-- Se principal_restante = 0 e status != 'pago', corrigir
UPDATE emprestimos 
SET status = 'pago', data_quitacao = NOW()
WHERE principal_restante = 0 AND status = 'ativo';
